// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { createHmac } from "node:crypto"
import type { checkout, customerPortal } from "../../convex/dodo"

import { api, internal } from "../../convex/_generated/api"
import { initConvexTest, seedAuthedUser } from "../../convex/test.helpers"

const { checkoutMock, portalMock } = vi.hoisted(() => ({
  checkoutMock: vi.fn<typeof checkout>(),
  portalMock: vi.fn<typeof customerPortal>(),
}))
vi.mock("../../convex/dodo", () => ({
  checkout: checkoutMock,
  customerPortal: portalMock,
}))

beforeEach(() => {
  vi.stubEnv("DODO_PRO_PRODUCT_ID", "pdt_lifetime")
  vi.stubEnv("SITE_URL", "https://streamhuddle.example")
  checkoutMock.mockReset().mockResolvedValue({ checkout_url: "https://checkout.dodopayments.com/session/test" })
  portalMock.mockReset().mockResolvedValue({ portal_url: "https://customer.dodopayments.com/test" })
})
afterEach(() => vi.unstubAllEnvs())

async function account() {
  const t = initConvexTest()
  const seeded = await seedAuthedUser(t)
  const user = await t.run(ctx => ctx.db.query("users").withIndex("authId", q => q.eq("authId", seeded.authUser._id)).unique())
  if (!user) throw new Error("Missing test user")
  return { t, user, ...seeded }
}

describe("Lifetime Pro checkout and entitlement reconciliation", () => {
  test("binds checkout to the authenticated app user and supplies the customer", async () => {
    const { asUser, user } = await account()
    await asUser.action(api.payments.createCheckout, {})
    expect(checkoutMock).toHaveBeenCalledWith(expect.anything(), {
      payload: expect.objectContaining({
        product_cart: [{ product_id: "pdt_lifetime", quantity: 1 }],
        metadata: { streamhuddle_user_id: user._id },
        customer: { email: expect.any(String), name: "Test User" },
        return_url: "https://streamhuddle.example/roster",
      }),
    })
  })

  test("rejects anonymous checkout and an already-active Lifetime Pro purchase", async () => {
    const { t, asUser, user } = await account()
    await expect(t.action(api.payments.createCheckout, {})).rejects.toThrow("Unauthenticated")
    await t.run(ctx => ctx.db.patch(user._id, { isPro: true }))
    await expect(asUser.action(api.payments.createCheckout, {})).rejects.toThrow("already have")
    expect(checkoutMock).not.toHaveBeenCalled()
  })

  test("first successful payment saves the customer and activates Pro idempotently", async () => {
    const { t, user } = await account()
    const args = { paymentId: "pay_first", customerId: "cus_first", productId: "pdt_lifetime", appUserId: user._id, fullyRefunded: false }
    await t.mutation(internal.payments.recordProPayment, args)
    await t.mutation(internal.payments.recordProPayment, args)
    expect(await t.run(ctx => ctx.db.get(user._id))).toMatchObject({ isPro: true, dodoCustomerId: "cus_first" })
    expect(await t.run(ctx => ctx.db.query("proPayments").collect())).toHaveLength(1)
  })

  test("a refund arriving before success and repeated success never grant access", async () => {
    const { t, user } = await account()
    const args = { paymentId: "pay_refunded", customerId: "cus_refunded", productId: "pdt_lifetime", appUserId: user._id, fullyRefunded: false }
    await t.mutation(internal.payments.recordProRefund, { paymentId: args.paymentId })
    await t.mutation(internal.payments.recordProPayment, args)
    await t.mutation(internal.payments.recordProPayment, args)
    expect((await t.run(ctx => ctx.db.get(user._id)))?.isPro).toBe(false)
  })

  test("refunds revoke only their payment and a separate valid purchase preserves Pro", async () => {
    const { t, user } = await account()
    for (const paymentId of ["pay_a", "pay_b"]) {
      await t.mutation(internal.payments.recordProPayment, { paymentId, customerId: "cus_multi", productId: "pdt_lifetime", appUserId: user._id, fullyRefunded: false })
    }
    await t.mutation(internal.payments.recordProRefund, { paymentId: "pay_a" })
    expect((await t.run(ctx => ctx.db.get(user._id)))?.isPro).toBe(true)
    await t.mutation(internal.payments.recordProRefund, { paymentId: "pay_b" })
    expect((await t.run(ctx => ctx.db.get(user._id)))?.isPro).toBe(false)
  })

  test("disputes suspend access, a later win restores it, and stale events cannot undo the win", async () => {
    const { t, user } = await account()
    const paymentId = "pay_disputed"
    await t.mutation(internal.payments.recordProDispute, { paymentId, disputeId: "dis_one", won: false, eventAt: 10 })
    await t.mutation(internal.payments.recordProPayment, { paymentId, customerId: "cus_dispute", productId: "pdt_lifetime", appUserId: user._id, fullyRefunded: false })
    expect((await t.run(ctx => ctx.db.get(user._id)))?.isPro).toBe(false)
    await t.mutation(internal.payments.recordProDispute, { paymentId, disputeId: "dis_one", won: true, eventAt: 20 })
    await t.mutation(internal.payments.recordProDispute, { paymentId, disputeId: "dis_one", won: false, eventAt: 10 })
    expect((await t.run(ctx => ctx.db.get(user._id)))?.isPro).toBe(true)
    await t.mutation(internal.payments.recordProRefund, { paymentId })
    await t.mutation(internal.payments.recordProDispute, { paymentId, disputeId: "dis_one", won: true, eventAt: 30 })
    expect((await t.run(ctx => ctx.db.get(user._id)))?.isPro).toBe(false)
  })

  test("unrelated products and customer links belonging to another account cannot grant access", async () => {
    const { t, user } = await account()
    await t.mutation(internal.payments.recordProPayment, { paymentId: "pay_other", customerId: "cus_other", productId: "pdt_other", appUserId: user._id, fullyRefunded: false })
    expect((await t.run(ctx => ctx.db.get(user._id)))?.isPro).not.toBe(true)
    const other = await seedAuthedUser(t)
    await t.run(async ctx => {
      const owner = await ctx.db.query("users").withIndex("authId", q => q.eq("authId", other.authUser._id)).unique()
      if (!owner) throw new Error("Missing customer owner")
      await ctx.db.patch(owner._id, { dodoCustomerId: "cus_wrong" })
    })
    await expect(t.mutation(internal.payments.recordProPayment, { paymentId: "pay_wrong", customerId: "cus_wrong", productId: "pdt_lifetime", appUserId: user._id, fullyRefunded: false })).rejects.toThrow("does not match")
  })

  test("parallel first checkouts preserve both purchases and the original portal mapping", async () => {
    const { t, user, asUser } = await account()
    for (const [paymentId, customerId] of [["pay_parallel_a", "cus_primary"], ["pay_parallel_b", "cus_secondary"]]) {
      await t.mutation(internal.payments.recordProPayment, { paymentId, customerId, productId: "pdt_lifetime", appUserId: user._id, fullyRefunded: false })
    }
    await t.mutation(internal.payments.recordProRefund, { paymentId: "pay_parallel_a" })
    expect(await t.run(ctx => ctx.db.get(user._id))).toMatchObject({ isPro: true, dodoCustomerId: "cus_primary" })
    expect(await asUser.action(api.payments.getCustomerPortal, {})).toEqual({ portal_url: "https://customer.dodopayments.com/test" })
    expect(portalMock).toHaveBeenCalledOnce()
  })

  test("old checkouts with an existing customer mapping still activate Pro", async () => {
    const { t, user } = await account()
    await t.run(ctx => ctx.db.patch(user._id, { dodoCustomerId: "cus_legacy" }))
    await t.mutation(internal.payments.recordProPayment, { paymentId: "pay_legacy", customerId: "cus_legacy", productId: "pdt_lifetime", fullyRefunded: false })
    expect((await t.run(ctx => ctx.db.get(user._id)))?.isPro).toBe(true)
  })

  test("account deletion cleans its ledger and late payment delivery cannot recreate it", async () => {
    const { t, user, authUser } = await account()
    const args = { paymentId: "pay_delete", customerId: "cus_delete", productId: "pdt_lifetime", appUserId: user._id, fullyRefunded: false }
    await t.mutation(internal.payments.recordProPayment, args)
    await t.mutation(internal.payments.recordProDispute, { paymentId: args.paymentId, disputeId: "dis_delete", won: false, eventAt: 1 })
    await t.mutation(internal.auth.cleanupDeletedUserData, { userId: user._id, authId: authUser._id })
    await t.mutation(internal.auth.cleanupDeletedUserData, { userId: user._id, authId: authUser._id })
    await t.mutation(internal.payments.recordProPayment, args)
    expect(await t.run(ctx => ctx.db.get(user._id))).toBeNull()
    expect(await t.run(ctx => ctx.db.query("proPayments").collect())).toHaveLength(0)
    expect(await t.run(ctx => ctx.db.query("proPaymentDisputes").collect())).toHaveLength(0)
  })

  test("the HTTP adapter rejects unsigned events and reconciles only signed one-time payments", async () => {
    const secret = btoa("test-only-signing-key-32-bytes-long")
    vi.stubEnv("DODO_PAYMENTS_WEBHOOK_SECRET", secret)
    const { t, user } = await account()
    const now = new Date()
    const customer = { customer_id: "cus_signed", email: "buyer@example.com", name: "Buyer", metadata: {}, phone_number: null }
    const payment = {
      payload_type: "Payment", payment_id: "pay_signed", business_id: "bus_test", brand_id: "brd_test",
      customer, created_at: now.toISOString(), updated_at: null, status: "succeeded", currency: "USD", total_amount: 2999,
      metadata: { streamhuddle_user_id: user._id }, product_cart: [{ product_id: "pdt_lifetime", quantity: 1 }],
      billing: { city: null, country: "US", state: null, street: null, zipcode: null },
      card_holder_name: null, card_issuing_country: null, card_last_four: null, card_network: null, card_type: null,
      checkout_session_id: "cks_test", custom_field_responses: null, digital_products_delivered: false,
      discount_id: null, error_code: null, error_message: null, invoice_id: null, invoice_url: null,
      payment_link: null, payment_method: null, payment_method_type: null, refunds: [], refund_status: null,
      settlement_amount: 2999, settlement_currency: "USD", settlement_tax: null, subscription_id: null, tax: null,
    }
    let eventNumber = 0
    const post = async (type: string, data: object, signed = true) => {
      const body = JSON.stringify({ type, data, business_id: "bus_test", timestamp: now.toISOString() })
      const id = `evt_test_${++eventNumber}`
      return await t.fetch("/dodopayments-webhook", {
        method: "POST", body,
        headers: {
          "webhook-id": id, "webhook-timestamp": String(Math.floor(now.getTime() / 1000)),
          "webhook-signature": signed
            ? `v1,${createHmac("sha256", Buffer.from(secret, "base64")).update(`${id}.${Math.floor(now.getTime() / 1000)}.${body}`).digest("base64")}`
            : "v1,invalid",
        },
      })
    }
    expect((await post("payment.succeeded", payment, false)).status).toBe(400)
    expect((await t.run(ctx => ctx.db.get(user._id)))?.isPro).not.toBe(true)
    expect((await post("payment.succeeded", { ...payment, subscription_id: "sub_unexpected" })).status).toBe(200)
    expect((await t.run(ctx => ctx.db.get(user._id)))?.isPro).not.toBe(true)
    expect((await post("payment.succeeded", payment)).status).toBe(200)
    expect((await t.run(ctx => ctx.db.get(user._id)))?.isPro).toBe(true)
    const refund = {
      payload_type: "Refund", refund_id: "ref_test", payment_id: payment.payment_id,
      business_id: "bus_test", customer, created_at: now.toISOString(), status: "succeeded",
      amount: 100, currency: "USD", reason: null, metadata: {}, is_partial: true,
    }
    expect((await post("refund.succeeded", refund)).status).toBe(200)
    expect((await t.run(ctx => ctx.db.get(user._id)))?.isPro).toBe(true)
    expect((await post("refund.succeeded", { ...refund, is_partial: false, amount: 2999 })).status).toBe(200)
    expect((await t.run(ctx => ctx.db.get(user._id)))?.isPro).toBe(false)
    expect((await post("payment.succeeded", payment)).status).toBe(200)
    expect((await t.run(ctx => ctx.db.get(user._id)))?.isPro).toBe(false)
  })
})

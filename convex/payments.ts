import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { requireAuthenticatedUser } from "./auth";
import { checkout, customerPortal } from "./dodo";

export const createCheckout = action({
  args: {},
  returns: v.object({ checkout_url: v.string() }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.runQuery(internal.payments.getCheckoutUser, {});
    if (user.isPro) throw new Error("You already have Lifetime Pro");

    const productId = process.env.DODO_PRO_PRODUCT_ID
    const siteUrl = process.env.SITE_URL
    if (!productId || !siteUrl) throw new Error("Checkout is not configured")
    const returnUrl = new URL("/roster", siteUrl).toString()

    try {
      const session = await checkout(ctx, {
        payload: {
          product_cart: [{ product_id: productId, quantity: 1 }],
          customer: user.dodoCustomerId
            ? { customer_id: user.dodoCustomerId }
            : { email: user.email, name: user.name },
          // checkout() does not call identify(). Keep account attribution in
          // server-owned metadata and grant access only from a signed webhook.
          metadata: { streamhuddle_user_id: user._id },
          return_url: returnUrl,
          billing_currency: "USD",
          feature_flags: {
            allow_discount_code: true,
            always_create_new_customer: !user.dodoCustomerId,
          },
        },
      });
      if (!session?.checkout_url) {
        throw new Error("Checkout session did not return a checkout_url");
      }
      return session;
    } catch (error) {
      console.error("Failed to create checkout session", error);
      throw new Error("Unable to create checkout session. Please try again.", { cause: error });
    }
  },
});

export const getCheckoutUser = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthenticatedUser(ctx);
    return { _id: user._id, email: user.email, name: user.name,
      isPro: user.isPro ?? false, dodoCustomerId: user.dodoCustomerId };
  },
});

async function refreshProAccess(ctx: MutationCtx, paymentId: Id<"proPayments">) {
  const payment = await ctx.db.get(paymentId);
  if (!payment) return;
  const blockedDispute = await ctx.db.query("proPaymentDisputes")
    .withIndex("by_paymentId_and_blocked", q => q.eq("paymentId", payment.paymentId).eq("blocked", true)).first();
  const active = payment.paid && !payment.refunded && !blockedDispute;
  await ctx.db.patch(paymentId, { active });
  if (!payment.userId) return;
  const user = await ctx.db.get(payment.userId);
  if (!user) return;
  const remainingPurchase = await ctx.db.query("proPayments")
    .withIndex("by_user_and_active", q => q.eq("userId", user._id).eq("active", true)).first();
  await ctx.db.patch(user._id, { isPro: !!remainingPurchase, updatedAt: Date.now() });
}

export const recordProPayment = internalMutation({
  args: {
    paymentId: v.string(), customerId: v.string(), productId: v.string(),
    appUserId: v.optional(v.string()), fullyRefunded: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!process.env.DODO_PRO_PRODUCT_ID || args.productId !== process.env.DODO_PRO_PRODUCT_ID) return null;
    const linkedUser = await ctx.db.query("users")
      .withIndex("by_dodoCustomerId", q => q.eq("dodoCustomerId", args.customerId)).unique();
    const metadataId = args.appUserId ? ctx.db.normalizeId("users", args.appUserId) : null;
    const user = args.appUserId ? (metadataId ? await ctx.db.get(metadataId) : null) : linkedUser;
    // Never match by checkout email or recreate an account deleted before the
    // webhook arrived. Existing mapped customers support older checkouts.
    if (!user) return null;
    const customerPurchase = await ctx.db.query("proPayments")
      .withIndex("by_customerId", q => q.eq("customerId", args.customerId)).first();
    if ((linkedUser && linkedUser._id !== user._id) ||
        (customerPurchase?.userId && customerPurchase.userId !== user._id)) {
      throw new Error("Payment customer does not match the account");
    }
    const existing = await ctx.db.query("proPayments")
      .withIndex("by_paymentId", q => q.eq("paymentId", args.paymentId)).unique();
    if ((existing?.userId && existing.userId !== user._id) ||
        (existing?.customerId && existing.customerId !== args.customerId)) {
      throw new Error("Payment already belongs to another account");
    }
    const data = {
      userId: user._id, customerId: args.customerId, productId: args.productId,
      paid: true, refunded: (existing?.refunded ?? false) || args.fullyRefunded,
    };
    const id = existing?._id ?? await ctx.db.insert("proPayments", {
      paymentId: args.paymentId, ...data, active: false,
    });
    if (existing) await ctx.db.patch(id, data);
    // Two first-checkout sessions can both create a customer before either
    // webhook is delivered. Keep the original portal customer, but honor both
    // verified purchases for the same account and track their reversals separately.
    if (!user.dodoCustomerId) await ctx.db.patch(user._id, { dodoCustomerId: args.customerId });
    await refreshProAccess(ctx, id);
    return null;
  },
});

export const recordProRefund = internalMutation({
  args: { paymentId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payment = await ctx.db.query("proPayments")
      .withIndex("by_paymentId", q => q.eq("paymentId", args.paymentId)).unique();
    const id = payment?._id ?? await ctx.db.insert("proPayments", {
      paymentId: args.paymentId, paid: false, refunded: true, active: false,
    });
    if (payment) await ctx.db.patch(id, { refunded: true });
    await refreshProAccess(ctx, id);
    return null;
  },
});

export const recordProDispute = internalMutation({
  args: { paymentId: v.string(), disputeId: v.string(), won: v.boolean(), eventAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.eventAt)) throw new Error("Invalid dispute timestamp");
    const previous = await ctx.db.query("proPaymentDisputes")
      .withIndex("by_disputeId", q => q.eq("disputeId", args.disputeId)).unique();
    if (previous && previous.paymentId !== args.paymentId) throw new Error("Dispute payment mismatch");
    // Re-deliveries and delayed earlier events cannot undo a later decision.
    if (previous && previous.eventAt >= args.eventAt) return null;
    const data = { paymentId: args.paymentId, disputeId: args.disputeId, blocked: !args.won, eventAt: args.eventAt };
    if (previous) await ctx.db.patch(previous._id, data);
    else await ctx.db.insert("proPaymentDisputes", data);
    const payment = await ctx.db.query("proPayments")
      .withIndex("by_paymentId", q => q.eq("paymentId", args.paymentId)).unique();
    const id = payment?._id ?? await ctx.db.insert("proPayments", {
      paymentId: args.paymentId, paid: false, refunded: false, active: false,
    });
    await refreshProAccess(ctx, id);
    return null;
  },
});

export const getCustomerPortal = action({
  args: {
    send_email: v.optional(v.boolean()),
  },
  returns: v.object({ portal_url: v.string() }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.runQuery(internal.payments.getCheckoutUser, {});
    if (!user.dodoCustomerId) throw new Error("No billing history is linked to your account");

    try {
      const portal = await customerPortal(ctx, args);
      if (!portal?.portal_url) {
        throw new Error("Customer portal did not return a portal_url");
      }
      return portal;
    } catch (error) {
      console.error("Failed to generate customer portal link", error);
      throw new Error("Unable to generate customer portal link. Please try again.", { cause: error });
    }
  },
});

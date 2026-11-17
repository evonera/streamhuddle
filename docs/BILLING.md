# Lifetime Pro billing

Lifetime Pro is one fixed-price purchase, with no renewals or subscription lifecycle. Configure `DODO_PRO_PRODUCT_ID` as a **One Time** product in the same Dodo environment as `DODO_PAYMENTS_API_KEY` and `DODO_PAYMENTS_ENVIRONMENT`. Confirm its price matches the pricing page before enabling checkout.

## Webhook setup

Register `https://<deployment>.convex.site/dodopayments-webhook` in Dodo's **Developer → Webhooks**. Subscribe to `payment.succeeded`, `refund.succeeded`, and every `dispute.*` event. Set the endpoint's signing secret as `DODO_PAYMENTS_WEBHOOK_SECRET` on that Convex deployment. The Convex adapter reads this variable directly; other Dodo adapters may use a different variable name.

Checkout derives the buyer from the authenticated account, passes its existing Dodo customer or authenticated email/name, and adds the app user ID to server-owned metadata. The return to `/roster` does not grant access. A verified successful one-time payment for the configured product creates an entitlement and saves the Dodo customer ID for the billing portal.

## Reversals and retries

- A successful **full** refund revokes that payment's entitlement.
- Partial refunds preserve access. Reconcile partial or cumulative refunds manually against the purchased line items and the refund policy; a payment snapshot reporting a full refund also revokes access.
- A dispute suspends that payment's entitlement. Only `dispute.won` restores it; accepted, cancelled, challenged, expired, and lost disputes keep it suspended. A refund cannot be undone by a dispute win.
- A separate valid purchase preserves Pro access if another payment is refunded or disputed.
- Parallel first purchases can create separate Dodo customers. Both verified purchases are recorded, while the billing portal keeps the first customer mapping. Review the secondary customer's receipt in Dodo when reconciling those exceptional duplicate purchases.
- The ledger keys payments and disputes by provider IDs, makes repeat delivery idempotent, and rejects stale dispute events. Reversals received before payment success prevent delayed delivery from granting access.
- Account deletion removes its app entitlement ledger and dispute records in batches. Dodo retains its own billing records; this does not request a refund.

## Existing purchases

Previously saved `isPro` values remain unchanged on deployment. Old checkouts with an existing `dodoCustomerId` mapping can still activate when their successful payment is replayed. Old first purchases without account metadata **and** without a saved customer mapping cannot be linked automatically. Reconcile those payments with the account holder and import or replay their verified payment data with the correct account attribution. Do not infer account ownership from the checkout email or a browser return URL.

Refund/dispute events for a historical purchase need its successful payment in the ledger to update the associated account. Reconcile the existing payment history before enabling automatic reversals for existing customers; otherwise only the provider payment's reversal tombstone is recorded until the verified purchase is linked. Never silently remove a customer's prior entitlement based on an unrelated failed checkout.

## Verification

Use test mode to complete a first purchase, confirm Pro and the billing portal customer mapping, and exercise a full refund and dispute replay. Tests cover signed webhook rejection, account attribution, duplicate and out-of-order delivery, reversals, multiple purchases, and account deletion. Tests mock checkout session creation; they do not charge a card or confirm the dashboard configuration.

References: [Convex component](https://docs.dodopayments.com/developer-resources/convex-component), [one-time payments](https://docs.dodopayments.com/features/one-time-payment-products), [webhooks](https://docs.dodopayments.com/developer-resources/webhooks), [refunds](https://docs.dodopayments.com/features/transactions/refunds), [dispute events](https://docs.dodopayments.com/developer-resources/webhooks/intents/dispute).

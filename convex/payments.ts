import { v } from "convex/values";
import { action } from "./_generated/server";
import { checkout, customerPortal } from "./dodo";

export const createCheckout = action({
  args: {
    productId: v.string(), // Dodo Payments Product ID
    returnUrl: v.string(),
  },
  returns: v.object({ checkout_url: v.string() }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    try {
      const session = await checkout(ctx, {
        payload: {
          product_cart: [{ product_id: args.productId, quantity: 1 }],
          return_url: args.returnUrl,
          billing_currency: "USD",
          feature_flags: {
            allow_discount_code: true,
          },
        },
      });
      if (!session?.checkout_url) {
        throw new Error("Checkout session did not return a checkout_url");
      }
      return session;
    } catch (error) {
      console.error("Failed to create checkout session", error);
      throw new Error("Unable to create checkout session. Please try again.");
    }
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

    try {
      const portal = await customerPortal(ctx, args);
      if (!portal?.portal_url) {
        throw new Error("Customer portal did not return a portal_url");
      }
      return portal;
    } catch (error) {
      console.error("Failed to generate customer portal link", error);
      throw new Error("Unable to generate customer portal link. Please try again.");
    }
  },
});

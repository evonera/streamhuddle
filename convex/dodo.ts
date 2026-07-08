import { DodoPayments, type DodoPaymentsClientConfig } from "@dodopayments/convex";
import { components, internal } from "./_generated/api";

export const dodo = new DodoPayments(components.dodopayments, {
  // Maps our Convex Better Auth user to a Dodo Payments customer
  identify: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    
    // Look up the user record in our app users table using the authId via query
    const user = await ctx.runQuery(internal.users.getUserByAuthId, {
      authId: identity.subject,
    });
      
    if (!user) {
      return null;
    }
    
    return {
      dodoCustomerId: user.dodoCustomerId,
    };
  },
  apiKey: process.env.DODO_PAYMENTS_API_KEY!,
  environment: (process.env.DODO_PAYMENTS_ENVIRONMENT as "test_mode" | "live_mode") || "test_mode",
} as DodoPaymentsClientConfig);

export const { checkout, customerPortal } = dodo.api();

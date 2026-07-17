/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as clipActions from "../clipActions.js";
import type * as clipWorkflow from "../clipWorkflow.js";
import type * as clips from "../clips.js";
import type * as constants from "../constants.js";
import type * as crons from "../crons.js";
import type * as dodo from "../dodo.js";
import type * as email from "../email.js";
import type * as errors from "../errors.js";
import type * as functions from "../functions.js";
import type * as http from "../http.js";
import type * as origins from "../origins.js";
import type * as payments from "../payments.js";
import type * as polling from "../polling.js";
import type * as r2 from "../r2.js";
import type * as rateLimit from "../rateLimit.js";
import type * as roster from "../roster.js";
import type * as seed from "../seed.js";
import type * as syncAvatars from "../syncAvatars.js";
import type * as twitch from "../twitch.js";
import type * as twitchOAuth from "../twitchOAuth.js";
import type * as users from "../users.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  clipActions: typeof clipActions;
  clipWorkflow: typeof clipWorkflow;
  clips: typeof clips;
  constants: typeof constants;
  crons: typeof crons;
  dodo: typeof dodo;
  email: typeof email;
  errors: typeof errors;
  functions: typeof functions;
  http: typeof http;
  origins: typeof origins;
  payments: typeof payments;
  polling: typeof polling;
  r2: typeof r2;
  rateLimit: typeof rateLimit;
  roster: typeof roster;
  seed: typeof seed;
  syncAvatars: typeof syncAvatars;
  twitch: typeof twitch;
  twitchOAuth: typeof twitchOAuth;
  users: typeof users;
  validators: typeof validators;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  dodopayments: import("@dodopayments/convex/_generated/component.js").ComponentApi<"dodopayments">;
  r2: import("@convex-dev/r2/_generated/component.js").ComponentApi<"r2">;
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
};

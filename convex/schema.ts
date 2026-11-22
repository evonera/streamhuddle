import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { streamerDataValidator } from "./streamerData"

// Rate limiting uses @convex-dev/rate-limiter component which manages its own tables.
// Better Auth handles identity tables (user, session, account, verification) via @convex-dev/better-auth.
//
// This app users table stores ONLY fields Better Auth can't represent:
// user bio and the Convex storage id for uploaded avatars.
// Identity fields (name, email, username, image) come from the Better Auth user and are
// merged at read time in convex/auth.ts safeGetAuthenticatedUser.

// Reusable field validators for the app users table. Creation time is the
// system field _creationTime; only the update time needs its own column.
export const userFields = {
  authId: v.string(), // FK to the Better Auth user id (indexed for efficient lookup)
  bio: v.optional(v.string()),
  avatar: v.optional(v.id("_storage")), // Convex storage id for uploaded avatars
  isPro: v.optional(v.boolean()),
  dodoCustomerId: v.optional(v.string()),
  role: v.optional(v.string()),
  favoriteStreamer: v.optional(v.string()),
  updatedAt: v.number(),
}

export default defineSchema({
  // App-specific user data. Better Auth owns identity fields.
  users: defineTable({
    authId: userFields.authId,
    bio: userFields.bio,
    avatar: userFields.avatar,
    // Legacy lease field: ignored by the one-request upload flow. Retained so
    // deployments with older records can accept the new schema without a backfill.
    avatarUploadPending: v.optional(v.boolean()),
    isPro: userFields.isPro,
    dodoCustomerId: userFields.dodoCustomerId,
    role: userFields.role,
    favoriteStreamer: userFields.favoriteStreamer,
    updatedAt: userFields.updatedAt,
  }).index("authId", ["authId"]).index("by_dodoCustomerId", ["dodoCustomerId"])
    .index("by_avatar", ["avatar"]),

  avatarUploads: defineTable({
    userId: v.id("users"),
    expiresAt: v.number(),
  }).index("by_userId", ["userId"]),

  streamerProfiles: defineTable({
    username: v.string(),
    data: v.optional(streamerDataValidator),
    expiresAt: v.number(),
    lease: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    purgeAt: v.number(),
  }).index("by_username", ["username"]).index("by_purgeAt", ["purgeAt"]),

  // Only verified payment events write entitlements. Reversal tombstones may
  // arrive before payment.succeeded, so user/customer fields start optional.
  proPayments: defineTable({
    paymentId: v.string(),
    userId: v.optional(v.id("users")),
    customerId: v.optional(v.string()),
    productId: v.optional(v.string()),
    paid: v.boolean(),
    refunded: v.boolean(),
    active: v.boolean(),
  }).index("by_paymentId", ["paymentId"])
    .index("by_customerId", ["customerId"])
    .index("by_user_and_active", ["userId", "active"]),

  proPaymentDisputes: defineTable({
    disputeId: v.string(),
    paymentId: v.string(),
    blocked: v.boolean(),
    eventAt: v.number(),
  }).index("by_disputeId", ["disputeId"])
    .index("by_paymentId_and_blocked", ["paymentId", "blocked"]),

  // 1. Events: General containers for tournaments/shows
  events: defineTable({
    name: v.string(),             // e.g. "Streamer University Season 1"
    slug: v.string(),             // e.g. "su-s1" (used in URLs)
    isActive: v.boolean(),        // Only poll live status for active events
  }).index("by_slug", ["slug"]).index("by_active", ["isActive"]),

  // 2. Creators: The streamers themselves
  creators: defineTable({
    platform: v.union(
      v.literal("twitch"), 
      v.literal("youtube"), 
      v.literal("kick"), 
      v.literal("custom")
    ),
    username: v.string(),         // e.g. "sarasaffari"
    platformId: v.optional(v.string()), // e.g. Twitch User ID (for faster API calls)
    avatarUrl: v.optional(v.string()),
    description: v.optional(v.string()), // Streamer bio from Twitch/Kick
    offlineImageUrl: v.optional(v.string()), 
    country: v.optional(v.string()),
    language: v.optional(v.string()),
    // Denormalized from liveStatusCache and roster for O(1) fetching
    isLive: v.optional(v.boolean()),
    viewerCount: v.optional(v.number()),
    streamTitle: v.optional(v.string()),
    categories: v.optional(v.array(v.string())),
  })
    .index("by_platform_and_username", ["platform", "username"])
    .index("by_isLive", ["isLive"]),

  // 3. Roster (Junction): Maps a creator to an event with a specific role
  roster: defineTable({
    eventId: v.id("events"),
    creatorId: v.id("creators"),
    category: v.string(),         // e.g. "Student", "Professor"
    team: v.optional(v.string()), // e.g. "Team A" (for esports)
  })
    .index("by_event", ["eventId"])
    .index("by_creator_and_event", ["creatorId", "eventId"]),

  // 4. Live Status Cache: DEPRECATED, no longer written. Live status lives on
  // `creators` (isLive/viewerCount/streamTitle) and in `pollLive`. Kept only so
  // existing rows still validate; safe to clear and drop later.
  liveStatusCache: defineTable({
    creatorId: v.id("creators"),
    isLive: v.boolean(),
    viewerCount: v.optional(v.number()),
    streamTitle: v.optional(v.string()),
    lastUpdated: v.number(),
  })
    .index("by_creator", ["creatorId"])
    .index("by_isLive", ["isLive"]),

  // 4b. Live-status poll state (convex/polling.ts). Two singleton docs kept
  // deliberately tiny because the poller reads them every few minutes.
  // Bounded by the active roster size (hundreds), well under array limits.
  pollTargets: defineTable({
    twitch: v.array(v.string()), // usernames to poll on Twitch
    kick: v.array(v.string()),   // usernames to poll on Kick
    builtAt: v.number(),         // ms; rebuilt when stale or invalidated
  }),
  // Schedule-poll targets for convex/upcoming.ts (hourly), rebuilt with
  // pollTargets so the hourly poll doesn't re-read every creator doc.
  upcomingTargets: defineTable({
    targets: v.array(v.object({
      creatorId: v.id("creators"),
      platform: v.union(v.literal("twitch"), v.literal("youtube")),
      platformId: v.string(),
      username: v.string(),
    })),
    builtAt: v.number(),
  }),
  pollLive: defineTable({
    // Creators currently live, with the values last written to their docs.
    live: v.array(v.object({
      platform: v.union(v.literal("twitch"), v.literal("kick")),
      username: v.string(),
      viewerCount: v.optional(v.number()),
      streamTitle: v.optional(v.string()),
    })),
  }),

  // 5. Custom Layouts: User saved rosters (e.g. "Night Stream")
  layouts: defineTable({
    authId: v.string(), // Links to Better Auth user authId
    name: v.string(), // e.g. "Night Stream"
    views: v.optional(v.number()), // 👈 Track popularity, optional for old layouts
    authorName: v.optional(v.string()), // 👈 Denormalized for Discover page
    previewStreams: v.optional(v.array(v.object({
      username: v.string(),
      type: v.string(),
    }))), // 👈 Denormalized snapshot for Discover page
    streams: v.array(v.object({
      creatorId: v.id("creators"),
      type: v.optional(v.union(v.literal("stream"), v.literal("chat"))) // 👈 Optional fallback
    }))
  })
    .index("by_user", ["authId"])
    .index("by_views", ["views"]),

  // 6. Twitch Tokens: Cached OAuth tokens (App Access Tokens)
  twitchTokens: defineTable({
    token: v.string(),
    expiresAt: v.number(), // timestamp ms
  }),

  // 7. Clip Queue: Viewer-submitted clips for streamer pages
  clipQueue: defineTable({
    creatorId: v.id("creators"),
    submitterId: v.optional(v.id("users")),
    submitterName: v.string(),
    clipUrl: v.string(),
    thumbnailUrl: v.optional(v.string()),
    title: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("playing"),
      v.literal("played")
    ),
    upvotes: v.number(),
    createdAt: v.number(),
  })
    // Upvotes patch this table constantly, so keep only indexes that are read.
    // by_creator_status_upvotes also serves (creatorId, status) lookups.
    .index("by_submitter", ["submitterId"])
    .index("by_creator_status_upvotes", ["creatorId", "status", "upvotes"])
    .index("by_creator_url_status", ["creatorId", "clipUrl", "status"]),

  // 8. Clip Queue Votes: One vote per user per queue item
  clipQueueVotes: defineTable({
    queueItemId: v.id("clipQueue"),
    userId: v.id("users"),
  })
    // by_item_and_user also serves per-item lookups (queueItemId prefix).
    .index("by_user", ["userId"])
    .index("by_item_and_user", ["queueItemId", "userId"]),

  // 9. Upcoming Events: Scheduled streams polled from platform schedule
  // APIs (Twitch schedule, YouTube upcoming; Kick has no schedule API).
  // Powers the Discover "Upcoming" section and event blog/streamlist curation.
  upcomingEvents: defineTable({
    creatorId: v.optional(v.id("creators")), // roster match, when known
    platform: v.union(
      v.literal("twitch"),
      v.literal("youtube"),
      v.literal("kick"),
    ),
    username: v.string(),         // channel handle for Play Now links
    title: v.optional(v.string()), // scheduled stream title
    startsAt: v.number(),          // timestamp ms
    url: v.optional(v.string()),   // watch URL
    videoId: v.optional(v.string()), // YouTube video ID (player needs this, not the handle)
    source: v.string(),            // e.g. "twitch-schedule", "youtube-upcoming"
  })
    .index("by_startsAt", ["startsAt"])
    .index("by_platform_and_username", ["platform", "username"]),
})

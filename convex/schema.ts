import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

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
  updatedAt: v.number(),
}

export default defineSchema({
  // App-specific user data. Better Auth owns identity fields.
  users: defineTable({
    authId: userFields.authId,
    bio: userFields.bio,
    avatar: userFields.avatar,
    isPro: userFields.isPro,
    dodoCustomerId: userFields.dodoCustomerId,
    role: userFields.role,
    updatedAt: userFields.updatedAt,
  }).index("authId", ["authId"]).index("by_dodoCustomerId", ["dodoCustomerId"]),

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
    .index("by_creator", ["creatorId"]),

  // 4. Live Status Cache: Updated by crons every 10 mins (Will be phased out in favor of denormalized creators table, kept for backward compatibility during migration)
  liveStatusCache: defineTable({
    creatorId: v.id("creators"),
    isLive: v.boolean(),
    viewerCount: v.optional(v.number()),
    streamTitle: v.optional(v.string()),
    lastUpdated: v.number(),
  })
    .index("by_creator", ["creatorId"])
    .index("by_isLive", ["isLive"]),

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

  // 6. Twitch Tokens: Cached OAuth tokens
  twitchTokens: defineTable({
    token: v.string(),
    expiresAt: v.number(), // timestamp ms
  }),
})

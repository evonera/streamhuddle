import { query, mutation, action, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAuthenticatedUser } from "./auth";
import { internal } from "./_generated/api";

// ----------------------------------------------------------------------------
// Admin Authorization Helper
// ----------------------------------------------------------------------------
async function requireAdmin(ctx: any) {
  const user = await requireAuthenticatedUser(ctx);
  // Ensure the user has the "admin" role (assigned via Better Auth)
  if (user.role !== "admin") {
    throw new ConvexError("Unauthorized: Admins only.");
  }
  return user;
}

// ----------------------------------------------------------------------------
// Admin Queries
// ----------------------------------------------------------------------------

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    // TODO: If the app scales, install the @convex-dev/aggregate component to track counts efficiently.
    // Never use .collect().length to count rows in production at scale as it loads all documents into memory.
    const creators = await ctx.db.query("creators").collect();
    const liveStatuses = await ctx.db.query("liveStatusCache").filter(q => q.eq(q.field("isLive"), true)).collect();
    const layouts = await ctx.db.query("layouts").collect();
    const users = await ctx.db.query("users").collect();

    return {
      totalCreators: creators.length,
      currentlyLive: liveStatuses.length,
      totalLayouts: layouts.length,
      totalUsers: users.length,
    };
  }
});

export const checkAdminInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthenticatedUser(ctx);
    return user.role === "admin";
  }
});

// ----------------------------------------------------------------------------
// Admin Mutations / Actions
// ----------------------------------------------------------------------------

export const forceLiveStatusRefresh = action({
  args: {},
  handler: async (ctx) => {
    // Actions can't directly check DB auth easily without a query.
    // We run a query to check if the user is an admin.
    const isAdmin = await ctx.runQuery(internal.admin.checkAdminInternal);
    if (!isAdmin) throw new ConvexError("Unauthorized");
    
    await ctx.runAction(internal.polling.pollAllPlatforms);
  }
});

export const addCreator = mutation({
  args: {
    platform: v.union(v.literal("twitch"), v.literal("youtube"), v.literal("kick"), v.literal("custom")),
    username: v.string(),
    platformId: v.optional(v.string()),
    category: v.string(),
    country: v.optional(v.string()),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Get active event
    const activeEvent = await ctx.db.query("events").filter(q => q.eq(q.field("isActive"), true)).first();
    if (!activeEvent) {
      throw new ConvexError("No active event found to assign this creator to.");
    }

    // Check if creator exists
    const existing = await ctx.db
      .query("creators")
      .withIndex("by_platform_and_username", q => 
        q.eq("platform", args.platform).eq("username", args.username.toLowerCase())
      )
      .first();

    let creatorId = existing?._id;

    if (!creatorId) {
      creatorId = await ctx.db.insert("creators", {
        platform: args.platform,
        username: args.username.toLowerCase(),
        platformId: args.platformId,
        country: args.country,
        language: args.language,
      });
    }

    // Add to roster if not already there
    const existingRoster = await ctx.db
      .query("roster")
      .withIndex("by_creator", q => q.eq("creatorId", creatorId!))
      .filter(q => q.eq(q.field("eventId"), activeEvent._id))
      .first();

    if (!existingRoster) {
      await ctx.db.insert("roster", {
        eventId: activeEvent._id,
        creatorId: creatorId,
        category: args.category,
      });
    }

    return { success: true, creatorId };
  }
});

export const removeCreator = mutation({
  args: {
    creatorId: v.id("creators")
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Delete from roster
    const rosters = await ctx.db
      .query("roster")
      .withIndex("by_creator", q => q.eq("creatorId", args.creatorId))
      .collect();
      
    for (const r of rosters) {
      await ctx.db.delete(r._id);
    }

    // Delete live status cache
    const liveStatuses = await ctx.db
      .query("liveStatusCache")
      .withIndex("by_creator", q => q.eq("creatorId", args.creatorId))
      .collect();
      
    for (const s of liveStatuses) {
      await ctx.db.delete(s._id);
    }

    // Scrub creator from saved layouts
    const layouts = await ctx.db.query("layouts").collect();
    for (const layout of layouts) {
      const updatedStreams = layout.streams.filter(s => s.creatorId !== args.creatorId);
      if (updatedStreams.length !== layout.streams.length) {
        // If the layout is now empty, delete it. Otherwise, update it.
        if (updatedStreams.length === 0) {
          await ctx.db.delete(layout._id);
        } else {
          await ctx.db.patch(layout._id, { streams: updatedStreams });
        }
      }
    }

    await ctx.db.delete(args.creatorId);
  }
});

import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { safeGetAuthenticatedUser } from "./auth";
import { rateLimitWithThrow } from "./rateLimit";

// Added return validators to all functions per guidelines.
const creatorReturnValidator = v.object({
  _id: v.id("creators"),
  _creationTime: v.number(),
  platform: v.string(),
  username: v.string(),
  platformId: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),
  description: v.optional(v.string()),
  offlineImageUrl: v.optional(v.string()),
  country: v.optional(v.string()),
  language: v.optional(v.string()),
  isLive: v.optional(v.boolean()),
  viewerCount: v.optional(v.number()),
  streamTitle: v.optional(v.string()),
  categories: v.optional(v.array(v.string())),
});

export const getAllCreators = query({
  args: {
    country: v.optional(v.string()),
    language: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  returns: v.array(creatorReturnValidator),
  handler: async (ctx, args) => {
    // 1. Fetch creators using denormalized fields
    // We use .take(500) to bound the result instead of .collect()
    let creators = await ctx.db.query("creators")
      .withIndex("by_isLive")
      .order("desc") // Put live first
      .take(500);
    
    if (args.country) {
      creators = creators.filter(c => c.country === args.country);
    }
    if (args.language) {
      creators = creators.filter(c => c.language === args.language);
    }
    if (args.category) {
      creators = creators.filter(c => c.categories?.includes(args.category!));
    }

    return creators;
  }
});

export const getCountriesAndLanguages = query({
  args: {},
  returns: v.object({ countries: v.array(v.string()), languages: v.array(v.string()) }),
  handler: async (ctx) => {
    // We bound this to 1000 to prevent OOM
    const creators = await ctx.db.query("creators").take(1000);
    const countries = new Set<string>();
    const languages = new Set<string>();
    
    creators.forEach(c => {
      if (c.country) countries.add(c.country);
      if (c.language) languages.add(c.language);
    });
    
    return {
      countries: Array.from(countries).sort(),
      languages: Array.from(languages).sort(),
    };
  }
});

const streamValidator = v.object({
  creatorId: v.id("creators"),
  type: v.optional(v.union(v.literal("stream"), v.literal("chat")))
});

export const saveLayout = mutation({
  args: {
    name: v.string(),
    creatorIds: v.array(v.object({
      id: v.id("creators"),
      type: v.union(v.literal("stream"), v.literal("chat"))
    }))
  },
  returns: v.object({ success: v.boolean(), layoutId: v.id("layouts") }),
  handler: async (ctx, args) => {
    const user = await safeGetAuthenticatedUser(ctx);
    if (!user) throw new ConvexError("Must be logged in to save a layout.");
    
    // Add rate limit
    await rateLimitWithThrow(ctx, "userAction", user.authId);

    const userLayouts = await ctx.db
      .query("layouts")
      .withIndex("by_user", q => q.eq("authId", user.authId))
      .collect();
      
    if (!user.isPro && userLayouts.length >= 1) {
      throw new ConvexError("Free tier is limited to 1 layout. Upgrade to Pro for unlimited configurations.");
    }
    
    const streams = args.creatorIds.map(c => ({ creatorId: c.id, type: c.type }));
    
    // Create snapshot data for Discover page
    let authorName = "User " + user.authId.slice(0, 4);
    if (user.name) {
      authorName = user.name;
    }

    const previewStreams = await Promise.all(
      streams.slice(0, 4).map(async s => {
        const c = await ctx.db.get(s.creatorId);
        return {
           username: c?.username || "Unknown",
           type: s.type || "stream"
        };
      })
    );
    
    const layoutId = await ctx.db.insert("layouts", {
      authId: user.authId,
      name: args.name,
      views: 0,
      authorName,
      previewStreams,
      streams
    });
    return { success: true, layoutId };
  }
});

const layoutReturnValidator = v.object({
  _id: v.id("layouts"),
  _creationTime: v.number(),
  authId: v.string(),
  name: v.string(),
  views: v.optional(v.number()),
  authorName: v.optional(v.string()),
  previewStreams: v.optional(v.array(v.object({ username: v.string(), type: v.string() }))),
  streams: v.array(streamValidator)
});

export const getUserLayouts = query({
  args: {},
  returns: v.array(layoutReturnValidator),
  handler: async (ctx) => {
    const user = await safeGetAuthenticatedUser(ctx);
    if (!user) return [];
    
    return await ctx.db
      .query("layouts")
      .withIndex("by_user", q => q.eq("authId", user.authId))
      .collect();
  }
});

export const deleteLayout = mutation({
  args: { layoutId: v.id("layouts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await safeGetAuthenticatedUser(ctx);
    if (!user) throw new Error("Must be logged in");
    
    const layout = await ctx.db.get(args.layoutId);
    if (!layout || layout.authId !== user.authId) {
      throw new Error("Layout not found or unauthorized");
    }
    
    await ctx.db.delete(args.layoutId);
    return null;
  }
});

export const getStreamListById = query({
  args: { id: v.id("layouts") },
  returns: v.union(layoutReturnValidator, v.null()),
  handler: async (ctx, args) => {
    const layout = await ctx.db.get(args.id);
    if (!layout) return null;
    return layout;
  }
});



export const incrementStreamListViews = mutation({
  args: { id: v.id("layouts") },
  returns: v.null(),
  handler: async (ctx, args) => {

    
    const layout = await ctx.db.get(args.id);
    if (!layout) return null;
    await ctx.db.patch(args.id, { views: (layout.views || 0) + 1 });
    return null;
  }
});

export const getDiscoverStreamLists = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("layouts"),
    name: v.string(),
    views: v.number(),
    authorName: v.string(),
    previewStreams: v.array(v.object({ username: v.string(), type: v.string() }))
  })),
  handler: async (ctx) => {
    // Collect top 20 layouts by views descending
    const topLayouts = await ctx.db
      .query("layouts")
      .withIndex("by_views")
      .order("desc")
      .take(20);
    
    // Now just map the denormalized data instead of doing 100+ DB reads!
    const result = topLayouts.map((layout) => {
      return {
        _id: layout._id,
        name: layout.name,
        views: layout.views || 0,
        authorName: layout.authorName || ("User " + layout.authId.slice(0, 4)),
        previewStreams: layout.previewStreams || []
      };
    });
    
    return result;
  }
});

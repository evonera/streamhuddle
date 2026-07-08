import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { safeGetAuthenticatedUser } from "./auth";

export const getAllCreators = query({
  args: {
    country: v.optional(v.string()),
    language: v.optional(v.string()),
    category: v.optional(v.string()), // we would filter by roster category if needed
  },
  handler: async (ctx, args) => {
    // 1. Fetch everything in parallel (O(3) queries instead of O(1+2N))
    let [creators, allLiveStatuses, allRosterEntries] = await Promise.all([
      ctx.db.query("creators").collect(),
      ctx.db.query("liveStatusCache").collect(),
      ctx.db.query("roster").collect()
    ]);
    
    if (args.country) {
      creators = creators.filter(c => c.country === args.country);
    }
    if (args.language) {
      creators = creators.filter(c => c.language === args.language);
    }

    // Build lookup maps in memory
    const liveStatusMap = new Map(allLiveStatuses.map(s => [s.creatorId, s]));
    
    const rosterMap = new Map<string, string[]>();
    allRosterEntries.forEach(r => {
      if (!rosterMap.has(r.creatorId)) rosterMap.set(r.creatorId, []);
      rosterMap.get(r.creatorId)!.push(r.category);
    });

    // 2. Map to their live statuses
    const result = creators.map((creator) => {
      const liveStatus = liveStatusMap.get(creator._id);
      const categories = rosterMap.get(creator._id) || [];

      return {
        ...creator,
        isLive: liveStatus?.isLive ?? false,
        viewerCount: liveStatus?.viewerCount,
        streamTitle: liveStatus?.streamTitle,
        categories,
      };
    });
    
    // 3. Filter by category if provided
    let filtered = result;
    if (args.category) {
      filtered = filtered.filter(c => c.categories.includes(args.category!));
    }

    // 4. Sort by live status and viewers
    return filtered.sort((a, b) => {
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      if (a.isLive && b.isLive) {
        return (b.viewerCount ?? 0) - (a.viewerCount ?? 0);
      }
      return 0;
    });
  }
});

export const getCountriesAndLanguages = query({
  args: {},
  handler: async (ctx) => {
    const creators = await ctx.db.query("creators").collect();
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

export const saveLayout = mutation({
  args: {
    name: v.string(),
    creatorIds: v.array(v.id("creators"))
  },
  handler: async (ctx, args) => {
    const user = await safeGetAuthenticatedUser(ctx);
    if (!user) throw new ConvexError("Must be logged in to save a layout.");
    
    // Enforce Free Tier Server-Side!
    const userLayouts = await ctx.db
      .query("layouts")
      .withIndex("by_user", q => q.eq("authId", user.authId))
      .collect();
      
    if (!user.isPro && userLayouts.length >= 1) {
      throw new ConvexError("Free tier is limited to 1 layout. Upgrade to Pro for unlimited configurations.");
    }
    
    const streams = args.creatorIds.map(creatorId => ({ creatorId }));
    
    const layoutId = await ctx.db.insert("layouts", {
      authId: user.authId,
      name: args.name,
      streams
    });
    return { success: true, layoutId };
  }
});

export const getUserLayouts = query({
  args: {},
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
  handler: async (ctx, args) => {
    const user = await safeGetAuthenticatedUser(ctx);
    if (!user) throw new Error("Must be logged in");
    
    const layout = await ctx.db.get(args.layoutId);
    if (!layout || layout.authId !== user.authId) {
      throw new Error("Layout not found or unauthorized");
    }
    
    await ctx.db.delete(args.layoutId);
  }
});

export const getStreamListById = query({
  args: { id: v.id("layouts") },
  handler: async (ctx, args) => {
    const layout = await ctx.db.get(args.id);
    if (!layout) return null;
    return layout;
  }
});

import { internalAction, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// ----------------------------------------------------------------------------
// Token Caching Helpers
// ----------------------------------------------------------------------------
export const getCachedTwitchToken = internalQuery({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    const tokenDoc = await ctx.db.query("twitchTokens").first();
    if (!tokenDoc) return null;
    
    // Check if expired (with 1 min buffer)
    if (Date.now() >= tokenDoc.expiresAt - 60000) {
      return null;
    }
    return tokenDoc.token;
  }
});

export const cacheTwitchToken = internalMutation({
  args: { token: v.string(), expiresIn: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Delete any existing tokens
    const existing = await ctx.db.query("twitchTokens").collect();
    for (const t of existing) {
      await ctx.db.delete(t._id);
    }
    
    await ctx.db.insert("twitchTokens", {
      token: args.token,
      expiresAt: Date.now() + (args.expiresIn * 1000)
    });
    
    return null;
  }
});

export async function getTwitchAccessToken(ctx: any): Promise<string> {
  // Try cache first
  const cached = await ctx.runQuery(internal.twitch.getCachedTwitchToken);
  if (cached) return cached;

  // Fetch new token
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error("Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET environment variables.");
  }

  const response = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, {
    method: "POST"
  });
  
  if (!response.ok) {
     throw new Error(`Failed to fetch Twitch token: ${response.status}`);
  }
  
  const data = await response.json() as { access_token: string, expires_in: number };
  
  // Cache it
  await ctx.runMutation(internal.twitch.cacheTwitchToken, { 
    token: data.access_token, 
    expiresIn: data.expires_in 
  });
  
  return data.access_token;
}

// ----------------------------------------------------------------------------
// Twitch API Actions
// ----------------------------------------------------------------------------

export const fetchTwitchUsers = internalAction({
  args: { usernames: v.array(v.string()) },
  returns: v.array(v.any()), // Can't strongly type Twitch API responses easily
  handler: async (ctx, args) => {
    if (args.usernames.length === 0) return [];
    
    // Twitch usernames must be alphanumeric/underscores only and not contain spaces.
    // Invalid characters will cause Twitch to throw a 400 Malformed query params error.
    const validUsernames = args.usernames.filter(u => /^[a-zA-Z0-9_]+$/.test(u));
    if (validUsernames.length === 0) return [];
    
    const token = await getTwitchAccessToken(ctx);
    const clientId = process.env.TWITCH_CLIENT_ID;
    
    // Split into chunks of 50 to avoid URL length limits and Malformed Query Params
    const chunkSize = 50;
    const allUsers: any[] = [];
    
    for (let i = 0; i < validUsernames.length; i += chunkSize) {
      const chunk = validUsernames.slice(i, i + chunkSize);
      const url = new URL("https://api.twitch.tv/helix/users");
      chunk.forEach(u => url.searchParams.append("login", u));

      const response = await fetch(url.toString(), {
        headers: {
          "Client-ID": clientId!,
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        console.error("Twitch API error (users)", await response.text(), "URL:", url.toString());
        continue;
      }
      
      const data = await response.json() as { data: any[] };
      allUsers.push(...data.data);
    }
    
    return allUsers;
  }
});

export const fetchTwitchStreams = internalAction({
  args: { logins: v.array(v.string()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    if (args.logins.length === 0) return [];
    
    // Twitch usernames must be alphanumeric/underscores only and not contain spaces.
    // Invalid characters will cause Twitch to throw a 400 Malformed query params error.
    const validLogins = args.logins.filter(u => /^[a-zA-Z0-9_]+$/.test(u));
    if (validLogins.length === 0) return [];
    
    const token = await getTwitchAccessToken(ctx);
    const clientId = process.env.TWITCH_CLIENT_ID;
    // Split into chunks of 50 to avoid URL length limits and Malformed Query Params
    const chunkSize = 50;
    const allStreams: any[] = [];
    
    for (let i = 0; i < validLogins.length; i += chunkSize) {
      const chunk = validLogins.slice(i, i + chunkSize);
      const url = new URL("https://api.twitch.tv/helix/streams");
      chunk.forEach(login => url.searchParams.append("user_login", login));

      const response = await fetch(url.toString(), {
        headers: {
          "Client-ID": clientId!,
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json() as { data: any[] };
        allStreams.push(...data.data);
      } else {
        console.error("Twitch stream fetch failed:", await response.text(), "URL:", url.toString());
      }
    }
    return allStreams;
  }
});

import { internalAction } from "./_generated/server";
import { v } from "convex/values";

export async function getTwitchAccessToken(): Promise<string> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error("Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET environment variables.");
  }

  const response = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, {
    method: "POST"
  });
  const data = await response.json() as { access_token: string };
  return data.access_token;
}

export const fetchTwitchUsers = internalAction({
  args: { usernames: v.array(v.string()) },
  handler: async (_ctx, args) => {
    if (args.usernames.length === 0) return [];
    
    const token = await getTwitchAccessToken();
    const clientId = process.env.TWITCH_CLIENT_ID;
    
    // Split into chunks of 100 (Twitch limit)
    const chunkSize = 100;
    const allUsers = [];
    
    for (let i = 0; i < args.usernames.length; i += chunkSize) {
      const chunk = args.usernames.slice(i, i + chunkSize);
      const url = new URL("https://api.twitch.tv/helix/users");
      chunk.forEach(u => url.searchParams.append("login", u));

      const response = await fetch(url.toString(), {
        headers: {
          "Client-ID": clientId!,
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        console.error("Twitch API error", await response.text());
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
  handler: async (_ctx, args) => {
    if (args.logins.length === 0) return [];
    
    const token = await getTwitchAccessToken();
    const clientId = process.env.TWITCH_CLIENT_ID;
    
    const chunkSize = 100;
    const allStreams = [];
    
    for (let i = 0; i < args.logins.length; i += chunkSize) {
      const chunk = args.logins.slice(i, i + chunkSize);
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
        console.error("Twitch stream fetch failed:", await response.text());
      }
    }
    return allStreams;
  }
});

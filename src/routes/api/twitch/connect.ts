import { createFileRoute } from "@tanstack/react-router"
import { getEnv } from '@/lib/env'

export const Route = createFileRoute("/api/twitch/connect")({
  server: {
    handlers: {
      GET: () => {
        const redirectBase = getEnv("TWITCH_REDIRECT_BASE_URL")
        let base: URL
        try {
          if (!redirectBase) throw new Error("Missing redirect URL")
          base = new URL(redirectBase)
          if (base.username || base.password || base.search || base.hash || base.pathname !== "/") throw new Error("Invalid redirect URL")
          if (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname))) throw new Error("Redirect URL must use HTTPS")
        } catch {
          return new Response("Invalid TWITCH_REDIRECT_BASE_URL", { status: 500 })
        }
        const redirectUri = new URL("/api/twitch/callback", base).toString()
        
        const clientId = getEnv('TWITCH_CLIENT_ID');
        if (!clientId) {
            return new Response("Missing TWITCH_CLIENT_ID", { status: 500 });
        }

        const state = crypto.randomUUID();

        const authUrl = new URL("https://id.twitch.tv/oauth2/authorize");
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("response_type", "code");
        // Request the scopes required to create and download clips
        authUrl.searchParams.set("scope", "clips:edit editor:manage:clips");
        authUrl.searchParams.set("force_verify", "true"); // Force user to re-approve to ensure we get a fresh token
        authUrl.searchParams.set("state", state);

        const isSecure = base.protocol === "https:";
        const cookieStr = `twitch_oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600${isSecure ? "; Secure" : ""}`;

        return new Response(null, {
            status: 302,
            headers: {
                Location: authUrl.toString(),
                "Set-Cookie": cookieStr
            }
        });
      },
    },
  },
})

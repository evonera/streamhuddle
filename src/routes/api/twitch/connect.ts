import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/api/twitch/connect")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url);
        const host = url.host || "localhost:3000";
        const redirectBase = process.env.TWITCH_REDIRECT_BASE_URL ?? (host.includes("localhost") ? `http://${host}` : `https://${host}`);
        const redirectUri = `${redirectBase}/api/twitch/callback`;
        
        const clientId = process.env.TWITCH_CLIENT_ID;
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

        const isSecure = !host.includes("localhost");
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

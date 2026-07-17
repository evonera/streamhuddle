import { createFileRoute } from "@tanstack/react-router"
import { ConvexHttpClient } from "convex/browser"
import { api } from "../../../../convex/_generated/api"
import { getToken } from "@/lib/auth-server"

export const Route = createFileRoute("/api/twitch/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        const stateParam = url.searchParams.get("state");
        
        // CSRF Check
        const cookies = request.headers.get("cookie") || "";
        const stateCookie = cookies.split("; ").find(c => c.startsWith("twitch_oauth_state="))?.split("=")[1];
        if (!stateCookie || stateCookie !== stateParam) {
            return Response.redirect(new URL("/roster?error=invalid_state", request.url).toString());
        }

        // Redirect back to roster if there's an error (e.g. user denied access)
        if (error || !code) {
            return Response.redirect(new URL("/roster?error=twitch_auth_failed", request.url).toString());
        }

        const clientId = process.env.TWITCH_CLIENT_ID;
        const clientSecret = process.env.TWITCH_CLIENT_SECRET;
        
        if (!clientId || !clientSecret) {
            return new Response("Missing Twitch Credentials", { status: 500 });
        }

        const host = url.host || "localhost:3000";
        const redirectBase = process.env.TWITCH_REDIRECT_BASE_URL ?? (host.includes("localhost") ? `http://${host}` : `https://${host}`);
        const redirectUri = `${redirectBase}/api/twitch/callback`;

        try {
            // 1. Exchange code for tokens
            const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    code,
                    grant_type: "authorization_code",
                    redirect_uri: redirectUri,
                })
            });

            if (!tokenRes.ok) {
                console.error("Twitch token exchange failed", await tokenRes.text());
                return Response.redirect(new URL("/roster?error=twitch_token_failed", request.url).toString());
            }

            const tokenData = await tokenRes.json();

            // 2. Fetch user profile
            const userRes = await fetch("https://api.twitch.tv/helix/users", {
                headers: {
                    Authorization: `Bearer ${tokenData.access_token}`,
                    "Client-Id": clientId,
                }
            });

            if (!userRes.ok) {
                return Response.redirect(new URL("/roster?error=twitch_user_failed", request.url).toString());
            }

            const userData = await userRes.json();
            if (!userData.data || userData.data.length === 0) {
                console.error("Twitch API returned empty user data", userData);
                return Response.redirect(new URL("/roster?error=twitch_user_not_found", request.url).toString());
            }
            const twitchUser = userData.data[0];

            // 3. Get the Convex Auth Token
            const convexToken = getToken(request);
            if (!convexToken) {
                // Not logged in to StreamHuddle
                return Response.redirect(new URL("/sign-in?redirect=/roster", request.url).toString());
            }

            // 4. Save to Convex
            const convexUrl = process.env.VITE_CONVEX_URL!;
            const client = new ConvexHttpClient(convexUrl);
            client.setAuth(convexToken);
            await client.mutation(api.twitchOAuth.saveTwitchToken, {
                twitchUserId: twitchUser.id,
                twitchUsername: twitchUser.login,
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                scopes: tokenData.scope ? tokenData.scope.join(" ") : "",
                expiresIn: tokenData.expires_in,
            });

            return Response.redirect(new URL("/roster?success=twitch_connected", request.url).toString());
        } catch (e) {
            console.error("Error in Twitch callback", e);
            return Response.redirect(new URL("/roster?error=internal_error", request.url).toString());
        }
      },
    },
  },
})

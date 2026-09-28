import { createFileRoute } from "@tanstack/react-router"
import { getEnv } from "@/lib/env"
import { getToken } from "@/lib/auth-server"

export const Route = createFileRoute("/api/twitch/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const clientId = getEnv("TWITCH_CLIENT_ID")
        const clientSecret = getEnv("TWITCH_CLIENT_SECRET")
        const configuredBase = getEnv("TWITCH_REDIRECT_BASE_URL")
        const convexCloudUrl = getEnv("VITE_CONVEX_URL")
        let base: URL
        try {
          if (!configuredBase) throw new Error("TWITCH_REDIRECT_BASE_URL is required")
          base = new URL(configuredBase)
          if (base.username || base.password || base.search || base.hash || base.pathname !== "/") throw new Error("Invalid redirect base URL")
          if (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname))) throw new Error("Redirect URL must use HTTPS")
        } catch {
          return new Response("Invalid Twitch redirect configuration", { status: 500 })
        }
        const callbackUrl = new URL("/api/twitch/callback", base)
        const clearCookie = `twitch_oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${base.protocol === "https:" ? "; Secure" : ""}`
        const redirect = (path: string) => {
          const response = Response.redirect(new URL(path, base).toString())
          response.headers.set("Set-Cookie", clearCookie)
          return response
        }
        const params = new URL(request.url).searchParams
        const code = params.get("code")
        const stateParam = params.get("state")
        const stateCookie = (request.headers.get("cookie") ?? "").split(";").map(v => v.trim()).find(v => v.startsWith("twitch_oauth_state="))?.slice("twitch_oauth_state=".length)
        if (!stateCookie || stateCookie !== stateParam) return redirect("/roster?error=invalid_state")
        if (params.has("error") || !code) return redirect("/roster?error=twitch_auth_failed")
        if (!clientId || !clientSecret || !convexCloudUrl) return new Response("Missing Twitch or Convex configuration", { status: 500, headers: { "Set-Cookie": clearCookie } })

        try {
          const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: callbackUrl.toString() }),
          })
          if (!tokenRes.ok) return redirect("/roster?error=twitch_token_failed")
          const tokenData = await tokenRes.json()
          const userRes = await fetch("https://api.twitch.tv/helix/users", { headers: { Authorization: `Bearer ${tokenData.access_token}`, "Client-Id": clientId } })
          if (!userRes.ok) return redirect("/roster?error=twitch_user_failed")
          const userData = await userRes.json()
          const twitchUser = userData.data?.[0]
          if (!twitchUser) return redirect("/roster?error=twitch_user_not_found")
          const convexToken = await getToken()
          if (!convexToken) return redirect("/sign-in?redirect=/roster")

          const siteUrl = convexCloudUrl.replace(/\.convex\.cloud\/?$/, ".convex.site")
          const saveRes = await fetch(`${siteUrl}/twitch-oauth-token`, {
            method: "POST",
            headers: { Authorization: `Bearer ${convexToken}`, "Content-Type": "application/json", "X-Twitch-OAuth-Secret": clientSecret },
            body: JSON.stringify({ twitchUserId: twitchUser.id, twitchUsername: twitchUser.login, accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token, scopes: tokenData.scope?.join(" ") ?? "", expiresIn: tokenData.expires_in }),
          })
          if (!saveRes.ok) throw new Error(`Token persistence failed (${saveRes.status})`)
          return redirect("/roster?success=twitch_connected")
        } catch (error) {
          console.error("Error in Twitch callback", error)
          return redirect("/roster?error=internal_error")
        }
      },
    },
  },
})

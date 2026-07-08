// SITE_URL falls back to localhost so a forker who skips `VITE_SITE_URL`
// produces obvious-wrong-in-prod SEO meta instead of pointing at someone
// else's deploy. Set `VITE_SITE_URL=https://your-app.example.com` per env.
export const SITE_URL = import.meta.env.VITE_SITE_URL ?? "http://localhost:3000"
export const SITE_NAME = "StreamHuddle"
export const SITE_TITLE = "StreamHuddle: The Ultimate Multi-Stream Viewer"
export const SITE_DESCRIPTION =
  "Watch multiple Twitch, Kick, YouTube, and Custom live streams simultaneously. Build and share your perfect StreamLists with StreamHuddle."
export const SITE_LOCALE = "en_US"
export const SITE_OG_IMAGE_ALT = "StreamHuddle Multi-Stream Viewer"

export const AUTHOR_NAME = "Ramon Claudio"
export const AUTHOR_URL = "https://github.com/ramonclaudio"
export const AUTHOR_TWITTER = "@ramonclaudio"
export const AUTHOR_GITHUB = "https://github.com/ramonclaudio"

export const REPO_URL = "https://github.com/ramonclaudio/tanvex"

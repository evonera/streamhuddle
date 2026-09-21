import { createFileRoute, redirect } from '@tanstack/react-router'
import { seo } from '@/lib/seo'
import { SITE_URL } from '@/lib/site'

export const Route = createFileRoute('/university')({
  head: () => ({
    meta: seo({
      title: "Watch — StreamHuddle",
      description:
        "Watch up to 30 live streams at once across Twitch, Kick, and YouTube.",
      image: "/og.png",
      url: `${SITE_URL}/roster`,
    }),
    links: [{ rel: "canonical", href: `${SITE_URL}/roster` }],
  }),
  // The Streamer University event is over: keep the URL alive for backlinks
  // but send everyone to the live roster.
  beforeLoad: () => {
    throw redirect({ to: "/roster" })
  },
})

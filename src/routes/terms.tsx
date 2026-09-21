import { createFileRoute } from "@tanstack/react-router"
import Container from "@/components/home/container"
import { seo } from "@/lib/seo"
import { SITE_URL } from "@/lib/site"

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: seo({
      title: "Terms of Service — StreamHuddle",
      description:
        "The terms governing your use of StreamHuddle, the free multi-stream viewer for Twitch, Kick, and YouTube.",
      url: `${SITE_URL}/terms`,
    }),
    links: [{ rel: "canonical", href: `${SITE_URL}/terms` }],
  }),
  component: TermsPage,
})

function TermsPage() {
  return (
    <Container className="py-24">
      <div className="prose prose-invert max-w-none">
        <h1>Terms of Service</h1>
        <p className="text-sm text-white/40">Last updated: September 2026</p>

        <h2>1. What StreamHuddle is</h2>
        <p>
          StreamHuddle is a free, open-source multi-stream viewer. It embeds
          third-party players (Twitch, Kick, YouTube) in your browser so you
          can watch several live streams at once. We do not host, restream, or
          copy anyone&apos;s content — playback is served directly by each
          platform under that platform&apos;s own terms.
        </p>

        <h2>2. Acceptable use</h2>
        <ul>
          <li>Do not use StreamHuddle to infringe copyright or evade platform restrictions.</li>
          <li>Do not abuse the service: no scraping, spamming votes/views, or circumventing rate limits.</li>
          <li>Clip-queue submissions must be links you have the right to share; no hateful or illegal content.</li>
        </ul>

        <h2>3. Accounts and Pro</h2>
        <p>
          Free accounts include 1 saved layout. Lifetime Pro adds unlimited
          layouts, premium themes, and a Pro badge. Purchases are handled by
          our payment provider (Dodo Payments) and are subject to their terms.
          Contact us via the repository issue tracker for billing problems.
        </p>

        <h2>4. Third-party content</h2>
        <p>
          Stream titles, thumbnails, avatars, chats, and clips belong to their
          respective streamers and platforms. StreamHuddle is not affiliated
          with Twitch, Kick, YouTube, or any streamer community unless stated.
        </p>

        <h2>5. No warranty</h2>
        <p>
          The service is provided &quot;as is&quot; under the AGPL-3.0 license,
          without warranties of any kind. We may change or discontinue features
          at any time.
        </p>

        <h2>6. Contact</h2>
        <p>
          Questions? Open an issue at{" "}
          <a href="https://github.com/evonera/streamhuddle">
            github.com/evonera/streamhuddle
          </a>
          .
        </p>
      </div>
    </Container>
  )
}

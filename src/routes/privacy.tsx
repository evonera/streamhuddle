import { createFileRoute } from "@tanstack/react-router"
import Container from "@/components/home/container"
import { seo } from "@/lib/seo"
import { SITE_URL } from "@/lib/site"

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: seo({
      title: "Privacy Policy — StreamHuddle",
      description:
        "How StreamHuddle handles your account data, viewing preferences, and analytics. Short version: we collect the minimum needed to run the app.",
      url: `${SITE_URL}/privacy`,
    }),
    links: [{ rel: "canonical", href: `${SITE_URL}/privacy` }],
  }),
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <Container className="py-24">
      <div className="prose prose-invert max-w-none">
        <h1>Privacy Policy</h1>
        <p className="text-sm text-white/40">Last updated: September 2026</p>

        <h2>1. Data we store</h2>
        <ul>
          <li>
            <strong>Account:</strong> email/username and profile data you provide
            via sign-up or OAuth (Google, Twitch).
          </li>
          <li>
            <strong>App data:</strong> saved StreamList layouts, clip-queue
            submissions, and upvotes tied to your account.
          </li>
          <li>
            <strong>Local only:</strong> your current viewing session
            (active streams, layout) is kept in your browser&apos;s
            localStorage and never sent to our servers unless you save it as a layout.
          </li>
        </ul>

        <h2>2. Data we don&apos;t collect</h2>
        <p>
          We do not sell personal data, run third-party ad trackers, or store
          your platform passwords. OAuth tokens are used only to call the
          relevant platform APIs on your behalf.
        </p>

        <h2>3. Third parties</h2>
        <ul>
          <li>Embedded players (Twitch, Kick, YouTube) are subject to those platforms&apos; privacy policies once loaded.</li>
          <li>Payments are processed by Dodo Payments; we never see your card details.</li>
          <li>Transactional email is sent via Resend.</li>
        </ul>

        <h2>4. Your rights</h2>
        <p>
          You can update or delete your profile from the app at any time.
          Deleting your account removes your layouts and votes. Contact us via
          the repository issue tracker for data requests.
        </p>
      </div>
    </Container>
  )
}

import { createFileRoute } from "@tanstack/react-router"
import { Container } from "@/components/ui/container"

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <Container className="py-24">
      <div className="prose prose-invert max-w-none">
        <h1>Privacy Policy</h1>
        <p>Coming soon...</p>
      </div>
    </Container>
  )
}

import { createFileRoute } from "@tanstack/react-router"
import { Container } from "@/components/ui/container"

export const Route = createFileRoute("/terms")({
  component: TermsPage,
})

function TermsPage() {
  return (
    <Container className="py-24">
      <div className="prose prose-invert max-w-none">
        <h1>Terms of Service</h1>
        <p>Coming soon...</p>
      </div>
    </Container>
  )
}

import { createFileRoute } from "@tanstack/react-router"
import { Container } from "@/components/ui/container"

export const Route = createFileRoute("/copyright")({
  component: CopyrightPage,
})

function CopyrightPage() {
  return (
    <Container className="py-24">
      <div className="prose prose-invert max-w-none">
        <h1>Copyright Policy</h1>
        <p>Coming soon...</p>
      </div>
    </Container>
  )
}

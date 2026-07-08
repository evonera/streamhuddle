import { createFileRoute } from "@tanstack/react-router"
import { useAction } from "convex/react"
import { api } from "../../convex/_generated/api"
import { PricingTableOne } from "@/components/billingsdk/pricing-table-one"
import { plans } from "@/lib/billingsdk-config"

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
})

function PricingPage() {
  const createCheckout = useAction(api.payments.createCheckout)

  const handlePlanSelect = async (planId: string) => {
    if (planId !== "pro") return; // Free plan has no checkout

    try {
      // Create checkout session for "Lifetime Pro"
      const { checkout_url } = await createCheckout({
        productId: "prod_example_123", // FIXME: Update with your Dodo product ID
        returnUrl: `${window.location.origin}/roster`,
      })
      if (!checkout_url) {
        throw new Error("Missing checkout_url in response")
      }
      // Redirect to Dodo Payments checkout
      window.location.href = checkout_url
    } catch (error) {
      console.error("Failed to create checkout", error)
      alert("Unable to create checkout. Please try again.")
    }
  }

  return (
    <div className="container mx-auto p-8 max-w-5xl">
      <PricingTableOne
        plans={plans}
        title="Upgrade to Pro"
        description="Get unlimited custom layouts, zero ads, and exclusive profile badges."
        onPlanSelect={handlePlanSelect}
        size="medium"
        theme="classic"
      />
    </div>
  )
}

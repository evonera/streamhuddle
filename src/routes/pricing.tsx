import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useAction } from "convex/react"
import { api } from "../../convex/_generated/api"
import { PricingTableOne } from "@/components/billingsdk/pricing-table-one"
import { plans } from "@/lib/billingsdk-config"
import { seo } from "@/lib/seo"
import { SITE_URL } from "@/lib/site"

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: seo({
      title: "Pricing — StreamHuddle Pro",
      description:
        "StreamHuddle is free forever. Upgrade to Lifetime Pro for unlimited layouts, premium themes, and an exclusive badge.",
      url: `${SITE_URL}/pricing`,
    }),
    links: [{ rel: "canonical", href: `${SITE_URL}/pricing` }],
  }),
  component: PricingPage,
})

function PricingPage() {
  const createCheckout = useAction(api.payments.createCheckout)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  const handlePlanSelect = async (planId: string) => {
    if (planId !== "pro") return; // Free plan has no checkout
    setCheckoutError(null)

    try {
      // Create checkout session for "Lifetime Pro"
      const { checkout_url } = await createCheckout({
        productId: "pdt_0NjG80JquVO61z1ctWCt8",
        returnUrl: `${window.location.origin}/roster`,
      })
      if (!checkout_url) {
        throw new Error("Missing checkout_url in response")
      }
      // Redirect to Dodo Payments checkout
      window.location.href = checkout_url
    } catch (error) {
      console.error("Failed to create checkout", error)
      setCheckoutError("Unable to create checkout. Please try again.")
    }
  }

  return (
    <div className="container mx-auto p-8 max-w-5xl">
      {checkoutError && (
        <p role="alert" className="mb-4 border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {checkoutError}
        </p>
      )}
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

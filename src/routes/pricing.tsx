import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useRef, useState } from "react"
import { useAction, useConvexAuth, useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import { PricingTableOne } from "@/components/billingsdk/pricing-table-one"
import { plans } from "@/lib/billingsdk-config"
import { seo } from "@/lib/seo"
import { SITE_URL } from "@/lib/site"
import Navbar from "@/components/home/navbar"
import Footer from "@/components/home/footer"

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: seo({
      title: "Pricing — StreamHuddle Pro",
      description:
        "StreamHuddle is free to use. Upgrade to Lifetime Pro for unlimited layouts, eight premium themes, and a Pro badge.",
      url: `${SITE_URL}/pricing`,
    }),
    links: [{ rel: "canonical", href: `${SITE_URL}/pricing` }],
  }),
  component: PricingPage,
})

function PricingPage() {
  const createCheckout = useAction(api.payments.createCheckout)
  const navigate = useNavigate()
  const { isAuthenticated, isLoading } = useConvexAuth()
  const user = useQuery(api.users.getMe, isAuthenticated ? {} : "skip")
  const checkingAccount = isLoading || (isAuthenticated && user === undefined)
  const [checkoutPending, setCheckoutPending] = useState(false)
  const checkoutInFlight = useRef(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  const handlePlanSelect = async (planId: string) => {
    if (planId !== "pro" || checkingAccount || user?.isPro || checkoutInFlight.current) return
    if (!isAuthenticated) {
      await navigate({ to: "/sign-in", search: { redirect: "/pricing" } })
      return
    }
    checkoutInFlight.current = true
    setCheckoutPending(true)
    setCheckoutError(null)

    try {
      // Create checkout session for "Lifetime Pro"
      const { checkout_url } = await createCheckout({})
      if (!checkout_url) {
        throw new Error("Missing checkout_url in response")
      }
      // Redirect to Dodo Payments checkout
      window.location.href = checkout_url
    } catch (error) {
      console.error("Failed to create checkout", error)
      setCheckoutError("Unable to create checkout. Please try again.")
      checkoutInFlight.current = false
      setCheckoutPending(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container mx-auto max-w-5xl px-4 pb-16 pt-28 sm:px-8">
      {checkoutError && (
        <p role="alert" className="mb-4 border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {checkoutError}
        </p>
      )}
      <PricingTableOne
        plans={plans.map(plan => ({
          ...plan,
          buttonText: plan.id !== "pro" ? (user?.isPro ? "Free plan" : "Current plan")
            : user?.isPro ? "Your current plan"
              : checkingAccount ? "Checking account…"
                : checkoutPending ? "Opening checkout…"
                  : !isAuthenticated ? "Sign in to upgrade" : plan.buttonText,
        }))}
        disabledPlanIds={checkingAccount || user?.isPro ? ["free", "pro"] : ["free"]}
        pendingPlanId={checkoutPending ? "pro" : undefined}
        title={user?.isPro ? "Your Lifetime Pro plan" : "Upgrade to Pro"}
        description="Get unlimited custom layouts, eight premium themes, and an exclusive Pro badge with a one-time payment."
        onPlanSelect={handlePlanSelect}
        size="medium"
        theme="classic"
      />
      </main>
      <Footer />
    </div>
  )
}

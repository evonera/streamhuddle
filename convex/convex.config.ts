import betterAuth from "@convex-dev/better-auth/convex.config"
import rateLimiter from "@convex-dev/rate-limiter/convex.config"
import r2 from "@convex-dev/r2/convex.config"
import resend from "@convex-dev/resend/convex.config"
import workflow from "@convex-dev/workflow/convex.config"
import dodopayments from "@dodopayments/convex/convex.config"
import { defineApp } from "convex/server"

const app = defineApp()
app.use(betterAuth)
app.use(rateLimiter)
app.use(resend)
app.use(dodopayments)
app.use(r2)
app.use(workflow)

export default app

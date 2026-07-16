import {
  isReservedUsername,
  isValidUsernameFormat,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@convex/constants"
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon"
import Tick02Icon from "@hugeicons/core-free-icons/Tick02Icon"
import { HugeiconsIcon } from "@hugeicons/react"
import { useForm } from "@tanstack/react-form"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useConvexAuth } from "convex/react"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"
import { seo } from "@/lib/seo"
import { SITE_NAME, SITE_URL } from "@/lib/site"
import { cn } from "@/lib/utils"

const signInEmailSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`),
})

const signInUsernameSchema = z.object({
  username: z
    .string()
    .min(USERNAME_MIN_LENGTH, `Username must be at least ${USERNAME_MIN_LENGTH} characters.`),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`),
})

const emailOnlySchema = z.object({
  email: z.string().email("Please enter a valid email address."),
})

const resetPasswordSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your email."),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`),
})

const signUpSchema = z.object({
  username: z
    .string()
    .refine(
      (val) => val === "" || isValidUsernameFormat(val),
      `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters, letters, numbers, underscores, and dots only.`,
    )
    .refine(
      (val) => val === "" || !isReservedUsername(val),
      "This username is reserved and cannot be used.",
    ),
  email: z.string().email("Please enter a valid email address."),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`),
})

type AuthSearchParams = { redirect?: string; mode?: "signin" | "signup" }

// Post-auth redirects come from `_authed` as same-origin paths. Reject anything
// else ("//host" is protocol-relative) so ?redirect= can't send users off-site.
function sanitizeRedirect(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  if (!value.startsWith("/") || value.startsWith("//")) return undefined
  return value
}

const CANONICAL = `${SITE_URL}/sign-in`

export const Route = createFileRoute("/sign-in")({
  head: () => ({
    meta: seo({ title: `Sign in · ${SITE_NAME}`, url: CANONICAL }),
    links: [{ rel: "canonical", href: CANONICAL }],
  }),
  validateSearch: (search: Record<string, unknown>): AuthSearchParams => ({
    redirect: sanitizeRedirect(search.redirect),
    mode: search.mode === "signup" ? "signup" : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    if (context.isAuthenticated) {
      throw redirect({ to: search.redirect ?? "/" })
    }
  },
  component: SignInPage,
})

type AuthPhase =
  // Avatar lives on the phase so it's automatically forgotten when the user
  // backs out of verification; no risk of uploading it to a different account.
  | { kind: "default" }
  | { kind: "verify-signup"; email: string }
  | { kind: "otp-sign-in"; email: string }
  | { kind: "reset-request" }
  | { kind: "reset-verify"; email: string }

function SignInPage() {
  const [phase, setPhase] = useState<AuthPhase>({ kind: "default" })
  const { redirect: redirectTo, mode: searchMode } = Route.useSearch()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading } = useConvexAuth()

  // Auth flipped to authenticated: finish the pending avatar upload (if any)
  // then navigate. `beforeLoad` only redirects on fresh navigations, so this
  // effect handles the in-session transition (password sign-in, OTP sign-in,
  // or the autoSignInAfterVerification flip during email verification).
  useEffect(() => {
    if (isLoading || !isAuthenticated) return undefined
    let cancelled = false
    void (async () => {
      if (!cancelled) void navigate({ to: redirectTo ?? "/" })
    })()
    return () => {
      cancelled = true
    }
  }, [isLoading, isAuthenticated, phase, redirectTo, navigate])

  const resetToDefault = useCallback(() => setPhase({ kind: "default" }), [])

  // The phase machine, not an auth boundary, owns which form renders. If the
  // forms lived under <Unauthenticated>, the auth flip during sign-up (OTP
  // verify mints a session mid-flow) would unmount them and drop the user's
  // input. Auth state only decides the fallback branch below.
  return (
    <div className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-5xl px-6 py-16 sm:py-24">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
        {phase.kind !== "default" ? (
          <OTPFlows phase={phase} setPhase={setPhase} resetToSignIn={resetToDefault} />
        ) : isAuthenticated ? (
          <div className="flex justify-center pt-8">
            <Spinner className="size-6" />
          </div>
        ) : (
          <UnauthedView setPhase={setPhase} defaultMode={searchMode ?? "signin"} />
        )}
      </div>
    </div>
  )
}

function UnauthedView({ setPhase, defaultMode }: { setPhase: (phase: AuthPhase) => void; defaultMode: "signin" | "signup" }) {
  const [mode, setMode] = useState<"signin" | "signup">(defaultMode)
  const [signInMethod, setSignInMethod] = useState<"email" | "username">("email")
  const [serverError, setServerError] = useState("")

  const [isCheckingUsername, setIsCheckingUsername] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const usernameCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Holds the candidate the in-flight availability request is for. Responses
  // resolving for anything else are dropped, so a slow response for an old
  // keystroke can't overwrite the verdict for the current one.
  const pendingUsernameRef = useRef<string | null>(null)

  const checkUsernameAvailability = useCallback(async (username: string) => {
    if (!username || !isValidUsernameFormat(username)) {
      setUsernameAvailable(null)
      return
    }
    if (isReservedUsername(username)) {
      setUsernameAvailable(false)
      return
    }
    setIsCheckingUsername(true)
    pendingUsernameRef.current = username
    try {
      const result = await authClient.isUsernameAvailable({ username })
      if (pendingUsernameRef.current !== username) return
      if (result.data) setUsernameAvailable(result.data.available)
    } catch {
      if (pendingUsernameRef.current !== username) return
      setUsernameAvailable(null)
    } finally {
      if (pendingUsernameRef.current === username) {
        pendingUsernameRef.current = null
        setIsCheckingUsername(false)
      }
    }
  }, [])

  const handleUsernameChange = useCallback(
    (username: string) => {
      setUsernameAvailable(null)
      // Invalidate any in-flight check; its finally no longer owns the spinner.
      pendingUsernameRef.current = null
      setIsCheckingUsername(false)
      if (usernameCheckTimeoutRef.current) clearTimeout(usernameCheckTimeoutRef.current)
      if (username && isValidUsernameFormat(username)) {
        if (isReservedUsername(username)) {
          setUsernameAvailable(false)
          return
        }
        usernameCheckTimeoutRef.current = setTimeout(() => checkUsernameAvailability(username), 500)
      }
    },
    [checkUsernameAvailability],
  )

  useEffect(() => {
    return () => {
      if (usernameCheckTimeoutRef.current) clearTimeout(usernameCheckTimeoutRef.current)
    }
  }, [])

  const signInEmailForm = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: signInEmailSchema },
    onSubmit: async ({ value }) => {
      setServerError("")
      try {
        const result = await authClient.signIn.email({
          email: value.email,
          password: value.password,
        })
        if (result.error) {
          // Unverified account: auto-resend OTP and jump to verify step.
          // autoSignInAfterVerification on the server finishes the flow.
          if (result.error.code === "EMAIL_NOT_VERIFIED") {
            await authClient.emailOtp.sendVerificationOtp({
              email: value.email,
              type: "email-verification",
            })
            setPhase({ kind: "verify-signup", email: value.email })
            return
          }
          setServerError(result.error.message || "Sign in failed")
        }
      } catch {
        setServerError("An error occurred during sign in")
      }
    },
  })


  const signInUsernameForm = useForm({
    defaultValues: { username: "", password: "" },
    validators: { onSubmit: signInUsernameSchema },
    onSubmit: async ({ value }) => {
      setServerError("")
      try {
        const result = await authClient.signIn.username({
          username: value.username,
          password: value.password,
        })
        if (result.error) setServerError(result.error.message || "Sign in failed")
      } catch {
        setServerError("An error occurred during sign in")
      }
    },
  })

  const signUpForm = useForm({
    defaultValues: { username: "", email: "", password: "" },
    validators: { onSubmit: signUpSchema },
    onSubmit: async ({ value }) => {
      setServerError("")
      try {
        const result = await authClient.signUp.email({
          email: value.email,
          password: value.password,
          name: value.username || value.email.split('@')[0],
          ...(value.username && { username: value.username }),
        })
        if (result.error) {
          setServerError(result.error.message || "Sign up failed")
          return
        }
        // Stash the avatar on the phase; the parent uploads it once email
        // verification mints a session (authMutation would reject before that).
        setPhase({ kind: "verify-signup", email: value.email })
      } catch {
        setServerError("An error occurred during sign up")
      }
    },
  })

  const activeForm =
    mode === "signup"
      ? signUpForm
      : signInMethod === "email"
        ? signInEmailForm
        : signInMethod === "username"
          ? signInUsernameForm
          : signInEmailForm // fallback

  const handleModeChange = (next: "signin" | "signup") => {
    setMode(next)
    setServerError("")
    setUsernameAvailable(null)
  }

  const handleSignInMethodChange = (method: "email" | "username") => {
    setSignInMethod(method)
    setServerError("")
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void activeForm.handleSubmit()
      }}
    >
      <FieldSet>
        <FieldLegend>{mode === "signin" ? "Sign in" : "Create your account"}</FieldLegend>
        <FieldDescription>
          {mode === "signin"
            ? "Enter your credentials to access your account."
            : "A verification code will be sent to confirm your email."}
        </FieldDescription>

        <div className="flex flex-col gap-3 mt-4 mb-2">
          <Button 
            type="button" 
            variant="outline" 
            size="lg"
            className="w-full bg-white text-black hover:bg-gray-100 border-transparent font-bold text-base" 
            onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/" })}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none"/></svg>
            Continue with Google
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            size="lg"
            className="w-full bg-[#9146FF] text-white hover:bg-[#772CE8] border-transparent font-bold text-base" 
            onClick={() => authClient.signIn.social({ provider: "twitch", callbackURL: "/" })}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/></svg>
            Continue with Twitch
          </Button>
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground font-mono tracking-wider">Or continue with Email</span>
          </div>
        </div>

        <SegmentedToggle
          value={mode}
          options={[
            { value: "signin", label: "Sign in" },
            { value: "signup", label: "Sign up" },
          ]}
          onChange={handleModeChange}
        />

        <FieldGroup>
          {mode === "signup" && (
            <>
              <signUpForm.Field
                name="username"
                children={(field) => {
                  const invalid = field.state.meta.isTouched && !field.state.meta.isValid
                  const showAvailability = isValidUsernameFormat(field.state.value)
                  const unavailable = usernameAvailable === false
                  return (
                    <Field data-invalid={invalid || unavailable || undefined}>
                      <FieldLabel htmlFor={field.name}>Username (optional)</FieldLabel>
                      <div className="relative">
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => {
                            field.handleChange(e.target.value)
                            handleUsernameChange(e.target.value)
                          }}
                          aria-invalid={invalid || unavailable}
                          placeholder="johndoe"
                          autoComplete="username"
                          className="pr-9"
                        />
                        {showAvailability ? (
                          <div className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
                            {isCheckingUsername ? (
                              <Spinner className="size-4 text-muted-foreground" />
                            ) : usernameAvailable === true ? (
                              <HugeiconsIcon
                                icon={Tick02Icon}
                                strokeWidth={2}
                                className="size-4 text-primary"
                              />
                            ) : unavailable ? (
                              <HugeiconsIcon
                                icon={Cancel01Icon}
                                strokeWidth={2}
                                className="size-4 text-destructive"
                              />
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <FieldDescription>
                        {unavailable
                          ? "This username is not available."
                          : usernameAvailable === true
                            ? "Username is available."
                            : "A unique handle others can use to find you."}
                      </FieldDescription>
                      {invalid ? <FieldError errors={field.state.meta.errors} /> : null}
                    </Field>
                  )
                }}
              />
            </>
          )}

          {mode === "signin" ? (
            <>
              <SegmentedToggle
                value={signInMethod}
                options={[
                  { value: "email", label: "Email" },
                  { value: "username", label: "Username" },
                ]}
                onChange={handleSignInMethodChange}
                size="sm"
              />

              {signInMethod === "email" ? (
                <>
                  <signInEmailForm.Field
                    name="email"
                    children={(field) => {
                      const invalid = field.state.meta.isTouched && !field.state.meta.isValid
                      return (
                        <Field data-invalid={invalid || undefined}>
                          <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="email"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={invalid}
                            placeholder="you@example.com"
                            autoComplete="email"
                          />
                          {invalid ? <FieldError errors={field.state.meta.errors} /> : null}
                        </Field>
                      )
                    }}
                  />
                  <signInEmailForm.Field
                    name="password"
                    children={(field) => {
                      const invalid = field.state.meta.isTouched && !field.state.meta.isValid
                      return (
                        <Field data-invalid={invalid || !!serverError || undefined}>
                          <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="password"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={invalid || !!serverError}
                            placeholder="••••••••"
                            autoComplete="current-password"
                          />
                          {invalid ? <FieldError errors={field.state.meta.errors} /> : null}
                          {serverError ? <FieldError>{serverError}</FieldError> : null}
                        </Field>
                      )
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setServerError("")
                      setPhase({ kind: "reset-request" })
                    }}
                    className="-mt-1 self-start text-xs text-muted-foreground hover:text-foreground"
                  >
                    Forgot password?
                  </button>
                </>
              ) : null}

              {signInMethod === "otp" ? (
                <signInOtpEmailForm.Field
                  name="email"
                  children={(field) => {
                    const invalid = field.state.meta.isTouched && !field.state.meta.isValid
                    return (
                      <Field data-invalid={invalid || !!serverError || undefined}>
                        <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="email"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          aria-invalid={invalid || !!serverError}
                          placeholder="you@example.com"
                          autoComplete="email"
                        />
                        <FieldDescription>
                          We'll email you a 6-digit code. No password needed.
                        </FieldDescription>
                        {invalid ? <FieldError errors={field.state.meta.errors} /> : null}
                        {serverError ? <FieldError>{serverError}</FieldError> : null}
                      </Field>
                    )
                  }}
                />
              ) : null}

              {signInMethod === "username" ? (
                <>
                  <signInUsernameForm.Field
                    name="username"
                    children={(field) => {
                      const invalid = field.state.meta.isTouched && !field.state.meta.isValid
                      return (
                        <Field data-invalid={invalid || undefined}>
                          <FieldLabel htmlFor={field.name}>Username</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={invalid}
                            placeholder="johndoe"
                            autoComplete="username"
                          />
                          {invalid ? <FieldError errors={field.state.meta.errors} /> : null}
                        </Field>
                      )
                    }}
                  />
                  <signInUsernameForm.Field
                    name="password"
                    children={(field) => {
                      const invalid = field.state.meta.isTouched && !field.state.meta.isValid
                      return (
                        <Field data-invalid={invalid || !!serverError || undefined}>
                          <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="password"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={invalid || !!serverError}
                            placeholder="••••••••"
                            autoComplete="current-password"
                          />
                          {invalid ? <FieldError errors={field.state.meta.errors} /> : null}
                          {serverError ? <FieldError>{serverError}</FieldError> : null}
                        </Field>
                      )
                    }}
                  />
                </>
              ) : null}
            </>
          ) : (
            <>
              <signUpForm.Field
                name="email"
                children={(field) => {
                  const invalid = field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={invalid || undefined}>
                      <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="email"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={invalid}
                        placeholder="you@example.com"
                        autoComplete="email"
                      />
                      {invalid ? <FieldError errors={field.state.meta.errors} /> : null}
                    </Field>
                  )
                }}
              />
              <signUpForm.Field
                name="password"
                children={(field) => {
                  const invalid = field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={invalid || !!serverError || undefined}>
                      <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="password"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={invalid || !!serverError}
                        placeholder="••••••••"
                        autoComplete="new-password"
                      />
                      <FieldDescription>
                        At least {PASSWORD_MIN_LENGTH} characters.
                      </FieldDescription>
                      {invalid ? <FieldError errors={field.state.meta.errors} /> : null}
                      {serverError ? <FieldError>{serverError}</FieldError> : null}
                    </Field>
                  )
                }}
              />
            </>
          )}

          <activeForm.Subscribe
            selector={(state) => state.isSubmitting}
            children={(isSubmitting) => (
              <Button type="submit" disabled={isSubmitting} size="lg" className="w-full mt-2">
                {isSubmitting
                  ? "Loading..."
                  : mode === "signup"
                    ? "Create account"
                    : "Sign in"}
              </Button>
            )}
          />
        </FieldGroup>
      </FieldSet>
    </form>
  )
}

function OTPFlows({
  phase,
  setPhase,
  resetToSignIn,
}: {
  phase: Exclude<AuthPhase, { kind: "default" }>
  setPhase: (phase: AuthPhase) => void
  resetToSignIn: () => void
}) {
  const [serverError, setServerError] = useState("")
  const [info, setInfo] = useState("")

  const otpForm = useForm({
    defaultValues: { otp: "" },
    validators: { onSubmit: otpSchema },
    onSubmit: async ({ value }) => {
      setServerError("")
      setInfo("")
      try {
        if (phase.kind === "verify-signup") {
          const result = await authClient.emailOtp.verifyEmail({
            email: phase.email,
            otp: value.otp,
          })
          if (result.error) {
            setServerError(result.error.message || "Verification failed")
            return
          }
          // autoSignInAfterVerification on the server mints the session inline;
          // Authenticated boundary swaps views automatically.
          return
        }
        if (phase.kind === "otp-sign-in") {
          const result = await authClient.signIn.emailOtp({
            email: phase.email,
            otp: value.otp,
          })
          if (result.error) setServerError(result.error.message || "Sign in failed")
          return
        }
      } catch {
        setServerError("An error occurred. Please try again.")
      }
    },
  })

  const emailForm = useForm({
    defaultValues: { email: "" },
    validators: { onSubmit: emailOnlySchema },
    onSubmit: async ({ value }) => {
      setServerError("")
      setInfo("")
      try {
        const result = await authClient.emailOtp.requestPasswordReset({ email: value.email })
        if (result.error) {
          setServerError(result.error.message || "Could not send reset code")
          return
        }
        setPhase({ kind: "reset-verify", email: value.email })
      } catch {
        setServerError("An error occurred. Please try again.")
      }
    },
  })

  const resetForm = useForm({
    defaultValues: { otp: "", password: "" },
    validators: { onSubmit: resetPasswordSchema },
    onSubmit: async ({ value }) => {
      if (phase.kind !== "reset-verify") return
      setServerError("")
      setInfo("")
      try {
        const result = await authClient.emailOtp.resetPassword({
          email: phase.email,
          otp: value.otp,
          password: value.password,
        })
        if (result.error) {
          setServerError(result.error.message || "Reset failed")
          return
        }
        // Toast, not local state: resetToSignIn unmounts this form immediately.
        toast.success("Password updated. Sign in with your new password.")
        resetToSignIn()
      } catch {
        setServerError("An error occurred. Please try again.")
      }
    },
  })

  const resendOtp = async (type: "sign-in" | "email-verification" | "forget-password") => {
    if (phase.kind === "reset-request") return
    setServerError("")
    setInfo("")
    try {
      // Better Auth surfaces rate limits (429) as a returned error, not a
      // throw, so check it before announcing success.
      const result =
        type === "forget-password"
          ? await authClient.emailOtp.requestPasswordReset({ email: phase.email })
          : await authClient.emailOtp.sendVerificationOtp({ email: phase.email, type })
      if (result.error) {
        setServerError(result.error.message || "Could not send a new code. Try again.")
        return
      }
      setInfo("New code sent. Check your inbox.")
    } catch {
      setServerError("Could not send a new code. Try again.")
    }
  }

  if (phase.kind === "reset-request") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void emailForm.handleSubmit()
        }}
      >
        <FieldSet>
          <FieldLegend>Reset your password</FieldLegend>
          <FieldDescription>Enter your email and we'll send you a 6-digit code.</FieldDescription>
          <FieldGroup>
            <emailForm.Field
              name="email"
              children={(field) => {
                const invalid = field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={invalid || !!serverError || undefined}>
                    <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="email"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={invalid || !!serverError}
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                    {invalid ? <FieldError errors={field.state.meta.errors} /> : null}
                    {serverError ? <FieldError>{serverError}</FieldError> : null}
                  </Field>
                )
              }}
            />
            <emailForm.Subscribe
              selector={(state) => state.isSubmitting}
              children={(isSubmitting) => (
                <Button type="submit" disabled={isSubmitting} size="lg" className="w-full">
                  {isSubmitting ? "Loading..." : "Send reset code"}
                </Button>
              )}
            />
            <Button type="button" variant="ghost" onClick={resetToSignIn}>
              Back to sign in
            </Button>
          </FieldGroup>
        </FieldSet>
      </form>
    )
  }

  if (phase.kind === "reset-verify") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void resetForm.handleSubmit()
        }}
      >
        <FieldSet>
          <FieldLegend>Enter reset code</FieldLegend>
          <FieldDescription>
            We sent a 6-digit code to <strong className="text-foreground">{phase.email}</strong>.
          </FieldDescription>
          <FieldGroup>
            <resetForm.Field
              name="otp"
              children={(field) => {
                const invalid = field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={invalid || undefined}>
                    <FieldLabel htmlFor={field.name}>Verification code</FieldLabel>
                    <OtpCodeInput field={field} invalid={invalid} />
                    {invalid ? <FieldError errors={field.state.meta.errors} /> : null}
                  </Field>
                )
              }}
            />
            <resetForm.Field
              name="password"
              children={(field) => {
                const invalid = field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={invalid || !!serverError || undefined}>
                    <FieldLabel htmlFor={field.name}>New password</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={invalid || !!serverError}
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                    <FieldDescription>At least {PASSWORD_MIN_LENGTH} characters.</FieldDescription>
                    {invalid ? <FieldError errors={field.state.meta.errors} /> : null}
                    {serverError ? <FieldError>{serverError}</FieldError> : null}
                    {info ? <FieldDescription>{info}</FieldDescription> : null}
                  </Field>
                )
              }}
            />
            <resetForm.Subscribe
              selector={(state) => state.isSubmitting}
              children={(isSubmitting) => (
                <Button type="submit" disabled={isSubmitting} size="lg" className="w-full">
                  {isSubmitting ? "Loading..." : "Reset password"}
                </Button>
              )}
            />
            <Button type="button" variant="ghost" onClick={() => resendOtp("forget-password")}>
              Resend code
            </Button>
            <Button type="button" variant="ghost" onClick={resetToSignIn}>
              Back to sign in
            </Button>
          </FieldGroup>
        </FieldSet>
      </form>
    )
  }

  const isVerifySignup = phase.kind === "verify-signup"
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void otpForm.handleSubmit()
      }}
    >
      <FieldSet>
        <FieldLegend>{isVerifySignup ? "Verify your email" : "Enter sign-in code"}</FieldLegend>
        <FieldDescription>
          We sent a 6-digit code to <strong className="text-foreground">{phase.email}</strong>.
        </FieldDescription>
        <FieldGroup>
          <otpForm.Field
            name="otp"
            children={(field) => {
              const invalid = field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <Field data-invalid={invalid || !!serverError || undefined}>
                  <FieldLabel htmlFor={field.name}>Verification code</FieldLabel>
                  <OtpCodeInput field={field} invalid={invalid || !!serverError} />
                  {invalid ? <FieldError errors={field.state.meta.errors} /> : null}
                  {serverError ? <FieldError>{serverError}</FieldError> : null}
                  {info ? <FieldDescription>{info}</FieldDescription> : null}
                </Field>
              )
            }}
          />
          <otpForm.Subscribe
            selector={(state) => state.isSubmitting}
            children={(isSubmitting) => (
              <Button type="submit" disabled={isSubmitting} size="lg" className="w-full">
                {isSubmitting ? "Loading..." : isVerifySignup ? "Verify email" : "Sign in"}
              </Button>
            )}
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => resendOtp(isVerifySignup ? "email-verification" : "sign-in")}
          >
            Resend code
          </Button>
          <Button type="button" variant="ghost" onClick={resetToSignIn}>
            Back to sign in
          </Button>
        </FieldGroup>
      </FieldSet>
    </form>
  )
}

// The narrow slice of TanStack Form's FieldApi the OTP input needs, so one
// component serves fields from differently-typed forms.
type OtpFieldApi = {
  name: string
  state: { value: string }
  handleChange: (value: string) => void
  handleBlur: () => void
}

function OtpCodeInput({ field, invalid }: { field: OtpFieldApi; invalid: boolean }) {
  return (
    <InputOTP
      id={field.name}
      maxLength={6}
      pattern={REGEXP_ONLY_DIGITS}
      autoComplete="one-time-code"
      value={field.state.value}
      onChange={field.handleChange}
      onBlur={field.handleBlur}
      aria-invalid={invalid}
    >
      <InputOTPGroup>
        {Array.from({ length: 6 }, (_, i) => (
          <InputOTPSlot key={i} index={i} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  )
}

function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  size = "md",
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
  size?: "md" | "sm"
}) {
  return (
    <div className="flex overflow-hidden rounded-3xl border border-border bg-background p-1">
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              // rounded-2xl (18px) nests inside the rounded-3xl (22px) shell
              // with p-1: 22 - 4 = 18, per the radius ladder.
              "flex-1 rounded-2xl font-medium transition-colors",
              size === "sm" ? "py-1 text-xs" : "py-2 text-sm",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

# Security Audit Report

## Summary
- **Overall Risk:** Critical
- **Findings:** 1 Critical, 1 High, 1 Medium, 0 Low
- **Standards:** CWE Top 25 (2025), OWASP Top 10 (2025), CVSS 4.0

## Critical Findings

### 1. Shell-Quote Command Injection Vulnerability
- **Severity:** Critical | CVSS 4.0: ~8.1
- **CWE:** CWE-1395 (Software Supply Chain)
- **OWASP:** A03:2025 Software Supply Chain Failures
- **File:** package.json / package-lock.json
- **Evidence:** `npm audit` reports `shell-quote` <= 1.8.3 via `launch-editor`.
- **Risk:** Command injection if user input is passed to shell-quote.
- **Fix:** Run `npm audit fix` or update the vulnerable dependencies.

### 2. Unverified DodoPayments Webhook
- **Severity:** High | CVSS 4.0: ~8.0
- **CWE:** CWE-347 (Improper Verification of Cryptographic Signature)
- **OWASP:** A08:2025 Software/Data Integrity Failures
- **File:** convex/http.ts:88
- **Evidence:** 
```typescript
http.route({
  path: "/dodopayments-webhook",
  method: "POST",
  handler: createDodoWebhookHandler({
    onPaymentSucceeded: async (ctx, payload) => {
```
- **Risk:** Missing webhook signature verification allows anyone to spoof a POST request to `/dodopayments-webhook` and upgrade any user to Pro for free.
- **Fix:** Pass `webhookSecret: process.env.DODO_WEBHOOK_SECRET` (or the equivalent validation mechanism) into `createDodoWebhookHandler` to ensure the payload actually came from DodoPayments.

### 3. IP Spoofing in Rate Limiting
- **Severity:** Medium | CVSS 4.0: ~5.0
- **CWE:** CWE-348 (Use of Less Trusted Source)
- **OWASP:** A04:2025 Insecure Design
- **File:** convex/http.ts:153
- **Evidence:** 
```typescript
function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim()
  }
  return "unknown"
}
```
- **Risk:** The first IP in `x-forwarded-for` is provided by the client and trivially spoofable. Attackers can bypass API rate limits by continually randomizing the `X-Forwarded-For` header.
- **Fix:** Do not trust the first IP in the chain blindly. Use Convex's built-in client IP property on the request context if available, or extract the right-most (last) IP in the `X-Forwarded-For` chain if behind a trusted proxy.

## Passed Checks
- [x] No SQL injection found (Category 1)
- [x] No XSS or `dangerouslySetInnerHTML` found (Category 2)
- [x] Hardcoded secrets not found in source (Category 3)
- [x] Resend webhook verifies signatures properly (Category 47)
- [x] Better Auth limits brute force and implements secure sessions (Category 4)

## Compound Risks
- **Unverified Webhook + Free Pro Upgrade:** Missing signature on `/dodopayments-webhook` directly allows an attacker to elevate their account tier without payment.

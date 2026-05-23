import { toNextJsHandler } from "better-auth/next-js";
import { AUTH_RATE_LIMIT, clientIp, rateLimit } from "@/lib/api/rate-limit";
import { auth } from "@/lib/auth";
import { verifyTurnstile } from "@/lib/auth/turnstile";

const handlers = toNextJsHandler(auth);

// Account-creation / OAuth entry paths that the Turnstile signup gate (6c)
// protects. better-auth routes everything under /api/auth/*; we only gate the
// paths that mint a new account or start an OAuth flow.
function isGatedSignupPath(url: string): boolean {
  const path = new URL(url).pathname;
  return (
    path.endsWith("/sign-up/email") ||
    path.endsWith("/sign-in/social") ||
    path.includes("/sign-in/social")
  );
}

export const GET = handlers.GET;

export async function POST(req: Request): Promise<Response> {
  const ip = clientIp(req);

  // Abuse defense (6c): IP-keyed rate limit on every auth POST.
  const rl = rateLimit(ip, AUTH_RATE_LIMIT);
  if (!rl.ok) {
    return Response.json(
      { error: "rate_limited", message: "Too many auth attempts. Try again shortly." },
      { status: 429, headers: { "retry-after": String(Math.ceil(rl.resetMs / 1000)) } },
    );
  }

  // Signup gate (6c): verify the Turnstile token on account-creation / OAuth
  // start. The browser sends it via the `x-turnstile-token` header so we don't
  // consume the request body the handler needs. Bypassed in dev (no secret).
  if (isGatedSignupPath(req.url)) {
    const token = req.headers.get("x-turnstile-token");
    const ok = await verifyTurnstile(token, ip);
    if (!ok) {
      return Response.json(
        { error: "turnstile_failed", message: "Bot-protection check failed. Please retry." },
        { status: 403 },
      );
    }
  }

  return handlers.POST(req);
}

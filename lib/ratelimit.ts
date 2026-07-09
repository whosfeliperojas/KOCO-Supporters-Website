// Durable, per-serverless-instance-safe rate limiting for API routes.
// Backed by Upstash Redis (works correctly across Vercel's stateless function
// instances — an in-memory counter would reset on every cold start and could
// be bypassed just by hitting a fresh instance).
//
// Setup: create a free Upstash Redis database (upstash.com), then add to
// .env.local and the Vercel project's environment variables:
//   UPSTASH_REDIS_REST_URL=...
//   UPSTASH_REDIS_REST_TOKEN=...
// Without these, rate limiting is skipped (fails open) rather than crashing
// the app — see isConfigured below.
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const isConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

const redis = isConfigured ? Redis.fromEnv() : null;

const limiters = {
  // Generous: called while a volunteer is actively typing/editing (onBlur)
  similarIdeas: redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "1 m"), prefix: "rl:similar" }) : null,
  // Moderate: one call per successful save, not a hot path
  embedPost: redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "1 m"), prefix: "rl:embed" }) : null,
  // Strict: sensitive admin-only account-creation endpoint
  adminUsers: redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m"), prefix: "rl:admin-users" }) : null,
} as const;

export type LimiterName = keyof typeof limiters;

/** Returns { ok: true } if under the limit (or unconfigured — fails open), else { ok: false, retryAfterSeconds }. */
export async function checkRateLimit(name: LimiterName, identifier: string) {
  const limiter = limiters[name];
  if (!limiter) return { ok: true as const };

  const result = await limiter.limit(identifier);
  if (result.success) return { ok: true as const };
  return { ok: false as const, retryAfterSeconds: Math.ceil((result.reset - Date.now()) / 1000) };
}

/** Best-effort caller identity for rate-limit keying: prefer the authenticated user id, fall back to IP. */
export function clientIdentifier(request: Request, userId?: string | null) {
  if (userId) return `user:${userId}`;
  const fwd = request.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : "unknown";
  return `ip:${ip}`;
}

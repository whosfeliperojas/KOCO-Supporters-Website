import { NextResponse } from "next/server";

/**
 * GET /api/version — which commit is actually serving this site.
 *
 * Every user-facing change in this app sits behind authentication, so there was
 * no way to tell from outside whether a push had finished deploying. The
 * honest answer was always "pushed, probably built", which is not an answer.
 *
 * Vercel injects VERCEL_GIT_COMMIT_SHA at build time, so this reports the
 * commit the running build was made from. Deliberately public and deliberately
 * minimal: a commit SHA and a branch name, nothing about the environment's
 * configuration or secrets.
 *
 *   curl -s https://<host>/api/version
 */
export const dynamic = "force-dynamic";

export function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? null;

  return NextResponse.json(
    {
      commit: sha,
      short: sha ? sha.slice(0, 7) : null,
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      // "production" | "preview" | "development", or null when run locally.
      environment: process.env.VERCEL_ENV ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

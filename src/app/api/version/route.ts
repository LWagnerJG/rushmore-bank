import { NextResponse } from "next/server";
import { getPartyHost } from "@/lib/party";
import {
  resolveServingPlatform,
  type VersionPayload,
} from "@/shared/client-version";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function buildSha(): string {
  const raw =
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    // Cloudflare Workers Builds / OpenNext CI inject these when set at build time.
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    "local";
  return raw.slice(0, 8);
}

function platformFromRequest(request: Request): string {
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "";
  return resolveServingPlatform({
    beansPlatform: process.env.BEANS_PLATFORM,
    cfPages: process.env.CF_PAGES,
    vercel: process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV,
    host,
  });
}

/** GET /api/version — fresh deploy identity for stale-client detection. */
export async function GET(request: Request) {
  const body: VersionPayload = {
    sha: buildSha(),
    partyHost: getPartyHost(),
    generatedAt: new Date().toISOString(),
    platform: platformFromRequest(request),
  };
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
    },
  });
}

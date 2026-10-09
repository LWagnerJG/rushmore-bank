import { NextResponse } from "next/server";
import { getPartyHost } from "@/lib/party";
import type { VersionPayload } from "@/shared/client-version";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function buildSha(): string {
  const raw =
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    "local";
  return raw.slice(0, 8);
}

/** GET /api/version — fresh deploy identity for stale-client detection. */
export async function GET() {
  const body: VersionPayload = {
    sha: buildSha(),
    partyHost: getPartyHost(),
    generatedAt: new Date().toISOString(),
  };
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
    },
  });
}

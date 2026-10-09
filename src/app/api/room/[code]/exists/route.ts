import { NextRequest, NextResponse } from "next/server";
import { getPartyHost } from "@/lib/party";
import { normalizeRoomCode } from "@/shared/types";

/**
 * GET /api/room/[code]/exists
 *
 * Proxies a GET to the PartyServer room's onRequest handler and returns
 * { exists: boolean }. If the request fails we return { exists: true } so
 * the join is allowed (safe fallback — existing behaviour preserved).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code: rawCode } = await params;
  const code = normalizeRoomCode(rawCode);
  if (code.length !== 4) {
    return NextResponse.json({ exists: false }, { status: 200 });
  }

  const host = getPartyHost();
  const scheme =
    host.startsWith("127.0.0.1") || host.startsWith("localhost")
      ? "http"
      : "https";

  try {
    const url = `${scheme}://${host}/parties/main/${code}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      // Non-200 likely means room doesn't exist or onRequest not deployed yet.
      // Treat 404 as "not found"; other errors as "allow join" (safe fallback).
      if (res.status === 404) {
        return NextResponse.json({ exists: false }, { status: 200 });
      }
      return NextResponse.json({ exists: true }, { status: 200 });
    }
    const data = (await res.json()) as { exists?: boolean };
    return NextResponse.json({ exists: data.exists ?? true }, { status: 200 });
  } catch {
    // Network error or timeout — allow join (safe fallback).
    return NextResponse.json({ exists: true }, { status: 200 });
  }
}

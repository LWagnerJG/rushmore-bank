import { NextRequest, NextResponse } from "next/server";
import { normalizeRoomCode } from "@/shared/types";

const PARTYKIT_HOST =
  process.env.NEXT_PUBLIC_PARTYKIT_HOST ||
  "rushmore-bank.lwagnerjg.partykit.dev";

/**
 * GET /api/room/[code]/exists
 *
 * Proxies a GET to the PartyKit room's onRequest handler and returns
 * { exists: boolean }. If the PartyKit server hasn't been redeployed yet
 * (pre-onRequest), the request will fail and we return { exists: true } so
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

  try {
    const url = `https://${PARTYKIT_HOST}/parties/main/${code}`;
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

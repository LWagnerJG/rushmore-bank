import { NextResponse } from "next/server";
import { normalizeRoomCode } from "@/shared/types";

export const dynamic = "force-dynamic";

/** Logs how often the install-first escape hatch is used. */
export async function POST(request: Request) {
  let room = "";
  let count: number | null = null;
  try {
    const body = (await request.json()) as { room?: string; count?: number };
    room = normalizeRoomCode(body.room ?? "");
    if (typeof body.count === "number" && Number.isFinite(body.count)) {
      count = Math.floor(body.count);
    }
  } catch {
    /* empty body is fine */
  }
  console.info("[beans] continue-in-browser", { room: room || null, count });
  return NextResponse.json({ ok: true });
}

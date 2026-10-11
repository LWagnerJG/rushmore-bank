import type { Metadata } from "next";
import { normalizeRoomCode } from "@/shared/types";
import { roomManifestHref } from "@/shared/web-manifest";
import { JoinRoomEntry } from "@/components/JoinRoomEntry";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code: raw } = await params;
  const code = normalizeRoomCode(raw);
  return {
    title: code.length === 4 ? `Join ${code}` : "Join",
    manifest: roomManifestHref(code),
  };
}

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ name?: string; spectate?: string }>;
}) {
  const { code: raw } = await params;
  const sp = await searchParams;
  const code = normalizeRoomCode(raw);
  return (
    <JoinRoomEntry
      code={code}
      presetName={sp.name ?? ""}
      preferSpectate={sp.spectate === "1"}
    />
  );
}

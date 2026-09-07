import { normalizeRoomCode } from "@/shared/types";
import { RoomClient } from "@/components/RoomClient";

export default async function RoomPage({
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
    <RoomClient
      code={code}
      presetName={sp.name ?? ""}
      preferSpectate={sp.spectate === "1"}
    />
  );
}

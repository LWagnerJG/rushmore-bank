import { RoomClient } from "@/components/RoomClient";
import { normalizeRoomCode } from "@/shared/types";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: raw } = await params;
  const code = normalizeRoomCode(raw) || raw.toUpperCase();
  return <RoomClient code={code} />;
}

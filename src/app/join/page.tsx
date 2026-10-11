import { redirect } from "next/navigation";
import { normalizeRoomCode } from "@/shared/types";

export default async function JoinIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  const sp = await searchParams;
  const code = normalizeRoomCode(sp.room ?? "");
  if (code.length === 4) redirect(`/join/${code}`);
  redirect("/");
}

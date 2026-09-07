/** Deployed PartyKit host — used when NEXT_PUBLIC_PARTYKIT_HOST is unset. */
export const DEFAULT_PARTYKIT_HOST =
  "rushmore-bank.lwagnerjg.partykit.dev";

/** PartyKit host for browser clients. */
export function getPartyHost(): string {
  return process.env.NEXT_PUBLIC_PARTYKIT_HOST || DEFAULT_PARTYKIT_HOST;
}

export function getStablePlayerId(roomCode: string): string {
  if (typeof window === "undefined") return "ssr";
  const key = `rushmore-bank:pid:${roomCode}`;
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  window.localStorage.setItem(key, id);
  return id;
}

export function rememberDisplayName(name: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("rushmore-bank:name", name);
}

export function recallDisplayName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("rushmore-bank:name") ?? "";
}

/** PartyKit host for browser clients. */
export function getPartyHost(): string {
  if (process.env.NEXT_PUBLIC_PARTYKIT_HOST) {
    return process.env.NEXT_PUBLIC_PARTYKIT_HOST;
  }
  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "127.0.0.1:1999";
    }
    // Production fallback guess — prefer setting NEXT_PUBLIC_PARTYKIT_HOST
    return hostname;
  }
  return "127.0.0.1:1999";
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

/**
 * Device-stable client identity (no accounts).
 * Distinct from per-room guest player ids in party.ts.
 */

const CLIENT_ID_KEY = "quarry:client-id";

function newClientId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Stable across tabs/rooms on this browser/device; lives in localStorage. */
export function getStableClientId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const existing = window.localStorage.getItem(CLIENT_ID_KEY);
    if (existing) return existing;
    const id = newClientId();
    window.localStorage.setItem(CLIENT_ID_KEY, id);
    return id;
  } catch {
    return "local";
  }
}

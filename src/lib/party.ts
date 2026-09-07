/** Deployed PartyKit host — used when NEXT_PUBLIC_PARTYKIT_HOST is unset. */
export const DEFAULT_PARTYKIT_HOST = "rushmore-bank.lwagnerjg.partykit.dev";

/** PartyKit host for browser clients. */
export function getPartyHost(): string {
  return process.env.NEXT_PUBLIC_PARTYKIT_HOST || DEFAULT_PARTYKIT_HOST;
}

/** Secure guest token per room — not nickname-based. */
export function getStablePlayerId(roomCode: string): string {
  if (typeof window === "undefined") return "ssr";
  const key = `quarry:pid:${roomCode}`;
  // migrate old key if present
  const legacy = window.localStorage.getItem(`rushmore-bank:pid:${roomCode}`);
  const existing = window.localStorage.getItem(key) ?? legacy;
  if (existing) {
    window.localStorage.setItem(key, existing);
    return existing;
  }
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  window.localStorage.setItem(key, id);
  return id;
}

export function rememberDisplayName(name: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("quarry:name", name);
}

export function recallDisplayName(): string {
  if (typeof window === "undefined") return "";
  return (
    window.localStorage.getItem("quarry:name") ??
    window.localStorage.getItem("rushmore-bank:name") ??
    ""
  );
}

/** Private My Ideas — never sent to server / AI / spectator payloads. */
export function ideasStorageKey(
  room: string,
  playerId: string,
  topicId: string,
): string {
  return `quarry:ideas:${room}:${playerId}:${topicId}`;
}

export function loadIdeas(
  room: string,
  playerId: string,
  topicId: string,
): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(
      ideasStorageKey(room, playerId, topicId),
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string").slice(0, 40)
      : [];
  } catch {
    return [];
  }
}

export function saveIdeas(
  room: string,
  playerId: string,
  topicId: string,
  ideas: string[],
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    ideasStorageKey(room, playerId, topicId),
    JSON.stringify(ideas.slice(0, 40)),
  );
}

export function newActionId(): string {
  return `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Deployed PartyKit host — used when NEXT_PUBLIC_PARTYKIT_HOST is unset. */
export const DEFAULT_PARTYKIT_HOST = "rushmore-bank.lwagnerjg.partykit.dev";

/** PartyKit host for browser clients. */
export function getPartyHost(): string {
  return process.env.NEXT_PUBLIC_PARTYKIT_HOST || DEFAULT_PARTYKIT_HOST;
}

function newGuestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function sessionPidKey(roomCode: string): string {
  return `quarry:pid:session:${roomCode}`;
}

function lastPidKey(roomCode: string): string {
  return `quarry:pid:last:${roomCode}`;
}

/**
 * Per-tab guest id for this room. Uses sessionStorage so a second browser tab
 * gets a distinct id (localStorage would make handleJoin treat it as reconnect).
 * Also records the id in localStorage for explicit Rejoin only — never auto-reuse
 * a prior tab's localStorage id when opening a new tab.
 */
export function getStablePlayerId(roomCode: string): string {
  if (typeof window === "undefined") return "ssr";
  const sessionKey = sessionPidKey(roomCode);
  const existing = window.sessionStorage.getItem(sessionKey);
  if (existing) {
    window.localStorage.setItem(lastPidKey(roomCode), existing);
    return existing;
  }
  const id = newGuestId();
  window.sessionStorage.setItem(sessionKey, id);
  window.localStorage.setItem(lastPidKey(roomCode), id);
  return id;
}

/** Last guest id used in this room (any tab) — for explicit Rejoin UI only. */
export function getLastPlayerIdForRejoin(roomCode: string): string | null {
  if (typeof window === "undefined") return null;
  return (
    window.localStorage.getItem(lastPidKey(roomCode)) ??
    window.localStorage.getItem(`quarry:pid:${roomCode}`) ??
    window.localStorage.getItem(`rushmore-bank:pid:${roomCode}`)
  );
}

/** Adopt a prior guest id into this tab's session (explicit Rejoin). */
export function adoptPlayerIdForRejoin(roomCode: string, id: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(sessionPidKey(roomCode), id);
  window.localStorage.setItem(lastPidKey(roomCode), id);
}

const NAME_SESSION_KEY = "quarry:name:session";
const NAME_LOCAL_KEY = "quarry:name";

/**
 * Remember display name for this tab (sessionStorage) and as a soft home-page
 * default (localStorage). Session wins on recall so a second tab with ?name=
 * does not inherit another tab's nickname from shared localStorage.
 */
export function rememberDisplayName(name: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(NAME_SESSION_KEY, name);
  window.localStorage.setItem(NAME_LOCAL_KEY, name);
}

export function recallDisplayName(): string {
  if (typeof window === "undefined") return "";
  return (
    window.sessionStorage.getItem(NAME_SESSION_KEY) ??
    window.localStorage.getItem(NAME_LOCAL_KEY) ??
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

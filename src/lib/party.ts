/**
 * Default PartyServer host (no protocol) when NEXT_PUBLIC_PARTYKIT_HOST is unset.
 *
 * Env name is historical (pre-PartyServer); value is a workers.dev host, not
 * *.partykit.dev. Prefer setting NEXT_PUBLIC_PARTYKIT_HOST on Vercel.
 */
export const DEFAULT_PARTYKIT_HOST =
  "beans-party.beans-lwagner.workers.dev";

/** PartyServer (or local wrangler) host for browser clients. */
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
 * Also records the id in localStorage as the last one used — never auto-reuse
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


export type RoomSession = {
  code: string;
  name: string;
  role: "player" | "spectator";
  playerId: string;
  at: number;
};

function roomSessionKey(roomCode: string): string {
  return `quarry:room-session:${roomCode.toUpperCase()}`;
}

function roomRemovalKey(roomCode: string): string {
  return `quarry:room-removed:${roomCode.toUpperCase()}`;
}

/** A removed tab waits for a deliberate join, including after a reload. */
export function wasRemovedFromRoom(roomCode: string): boolean {
  return typeof window !== "undefined" &&
    window.sessionStorage.getItem(roomRemovalKey(roomCode)) === "1";
}

export function allowRoomRejoin(roomCode: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(roomRemovalKey(roomCode));
}

/** Forget this seat without clearing another tab's saved membership. */
export function markRoomRemoved(roomCode: string, playerId: string) {
  if (typeof window === "undefined") return;
  const code = roomCode.toUpperCase();
  window.sessionStorage.setItem(roomRemovalKey(code), "1");
  for (const storage of [window.sessionStorage, window.localStorage]) {
    const key = roomSessionKey(code);
    const raw = storage.getItem(key);
    if (raw) {
      try {
        if ((JSON.parse(raw) as RoomSession).playerId === playerId) {
          storage.removeItem(key);
        }
      } catch {
        storage.removeItem(key);
      }
    }
    for (const key of [
      sessionPidKey(code), lastPidKey(code),
      `quarry:pid:${code}`, `rushmore-bank:pid:${code}`,
    ]) {
      if (storage.getItem(key) === playerId) storage.removeItem(key);
    }
  }
}

/** Persist membership so brief leaves / app switches can auto-rejoin promptly. */
export function rememberRoomSession(session: RoomSession) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify(session);
  window.sessionStorage.setItem(roomSessionKey(session.code), payload);
  window.localStorage.setItem(roomSessionKey(session.code), payload);
  window.localStorage.setItem(lastPidKey(session.code), session.playerId);
  window.sessionStorage.setItem(sessionPidKey(session.code), session.playerId);
  rememberDisplayName(session.name);
}

function parseRoomSession(
  raw: string | null,
  roomCode: string,
  maxAgeMs: number,
): RoomSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RoomSession;
    if (
      !parsed?.code ||
      !parsed?.name ||
      !parsed?.playerId ||
      parsed.code.toUpperCase() !== roomCode.toUpperCase()
    ) {
      return null;
    }
    if (Date.now() - (parsed.at || 0) > maxAgeMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Auto-resume membership for THIS tab only (sessionStorage).
 * Never falls back to localStorage — that made a second tab steal the seat.
 */
export function recallRoomSession(
  roomCode: string,
  maxAgeMs = 2 * 60 * 60 * 1000,
): RoomSession | null {
  if (typeof window === "undefined") return null;
  if (wasRemovedFromRoom(roomCode)) return null;
  return parseRoomSession(
    window.sessionStorage.getItem(roomSessionKey(roomCode)),
    roomCode,
    maxAgeMs,
  );
}

/** Explicit Rejoin path may use the last localStorage membership. */
export function recallRoomSessionForRejoin(
  roomCode: string,
  maxAgeMs = 2 * 60 * 60 * 1000,
): RoomSession | null {
  if (typeof window === "undefined") return null;
  if (wasRemovedFromRoom(roomCode)) return null;
  const key = roomSessionKey(roomCode);
  return (
    parseRoomSession(window.sessionStorage.getItem(key), roomCode, maxAgeMs) ??
    parseRoomSession(window.localStorage.getItem(key), roomCode, maxAgeMs)
  );
}

/**
 * A player seat this device held here (another tab, or before the app was
 * closed) that this tab isn't already resuming. Unlike the last-used id, which
 * getStablePlayerId writes on every visit, this only exists after a real join.
 */
export function rejoinOffer(roomCode: string): RoomSession | null {
  if (recallRoomSession(roomCode)) return null;
  const prior = recallRoomSessionForRejoin(roomCode);
  return prior?.role === "player" ? prior : null;
}

export type SeatLockHandle = {
  /** True when another tab already claimed this playerId. */
  contested: boolean;
  release: () => void;
};

/**
 * BroadcastChannel seat lock — second tab with the same playerId is contested
 * so we do not open a reconnect war on one Party connection id.
 */
export function acquireSeatLock(
  roomCode: string,
  playerId: string,
  onContested: () => void,
): SeatLockHandle {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return { contested: false, release() {} };
  }
  const code = roomCode.toUpperCase();
  const tabId = newGuestId();
  const channel = new BroadcastChannel(`beans-seat:${code}`);
  let contested = false;
  let released = false;

  const onMessage = (ev: MessageEvent) => {
    const data = ev.data as {
      type?: string;
      playerId?: string;
      tabId?: string;
    };
    if (!data || data.tabId === tabId) return;
    if (data.playerId !== playerId) return;
    if (data.type === "claim" || data.type === "ping") {
      contested = true;
      onContested();
      channel.postMessage({ type: "busy", playerId, tabId });
    }
  };
  channel.addEventListener("message", onMessage);
  channel.postMessage({ type: "claim", playerId, tabId });
  // Ask any existing holder to announce.
  channel.postMessage({ type: "ping", playerId, tabId });

  return {
    get contested() {
      return contested;
    },
    release() {
      if (released) return;
      released = true;
      try {
        channel.postMessage({ type: "release", playerId, tabId });
        channel.removeEventListener("message", onMessage);
        channel.close();
      } catch {
        /* ignore */
      }
    },
  };
}

/** Clear remembered membership for this room (optional leave). */
export function clearRoomSession(roomCode: string) {
  if (typeof window === "undefined") return;
  const key = roomSessionKey(roomCode);
  window.sessionStorage.removeItem(key);
  window.localStorage.removeItem(key);
}

/**
 * Private draft Stash (formerly Ideas) — never sent to server / AI /
 * spectator payloads. Storage key kept as `quarry:ideas:` for continuity.
 */
export function stashStorageKey(
  room: string,
  playerId: string,
  topicId: string,
): string {
  return `quarry:ideas:${room}:${playerId}:${topicId}`;
}

/** @deprecated use stashStorageKey */
export const ideasStorageKey = stashStorageKey;

export function loadStash(
  room: string,
  playerId: string,
  topicId: string,
): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(
      stashStorageKey(room, playerId, topicId),
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

/** @deprecated use loadStash */
export const loadIdeas = loadStash;

export function saveStash(
  room: string,
  playerId: string,
  topicId: string,
  items: string[],
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    stashStorageKey(room, playerId, topicId),
    JSON.stringify(items.slice(0, 40)),
  );
}

/** @deprecated use saveStash */
export const saveIdeas = saveStash;

export function newActionId(): string {
  return `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

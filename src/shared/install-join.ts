import { normalizeRoomCode } from "@/shared/types";

export const CONTINUE_IN_BROWSER_COUNT_KEY = "beans:continue-in-browser-count";
export const INSTALL_JOIN_CONSUMED_KEY = "beans:install-join-consumed";

export function invitePath(code: string): string {
  return `/join/${normalizeRoomCode(code)}`;
}

export function inviteUrl(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}${invitePath(code)}`;
}

function continueSessionKey(code: string): string {
  return `beans:continue-in-browser:${normalizeRoomCode(code)}`;
}

export function hasContinuedInBrowser(
  code: string,
  storage: Pick<Storage, "getItem"> | null = defaultSession(),
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(continueSessionKey(code)) === "1";
  } catch {
    return false;
  }
}

export function rememberContinuedInBrowser(
  code: string,
  storage: Pick<Storage, "setItem"> | null = defaultSession(),
): void {
  if (!storage) return;
  try {
    storage.setItem(continueSessionKey(code), "1");
  } catch {
    /* private mode */
  }
}

export function readContinueInBrowserCount(
  storage: Pick<Storage, "getItem"> | null = defaultLocal(),
): number {
  if (!storage) return 0;
  try {
    const n = Number(storage.getItem(CONTINUE_IN_BROWSER_COUNT_KEY) ?? "0");
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** Persistent counter — how often the install escape hatch is used. */
export function recordContinueInBrowser(
  storage: Pick<Storage, "getItem" | "setItem"> | null = defaultLocal(),
): number {
  const next = readContinueInBrowserCount(storage) + 1;
  if (!storage) return next;
  try {
    storage.setItem(CONTINUE_IN_BROWSER_COUNT_KEY, String(next));
  } catch {
    /* ignore */
  }
  return next;
}

function consumedMapKey(code: string): string {
  return normalizeRoomCode(code);
}

export function isInstallJoinConsumed(
  code: string,
  storage: Pick<Storage, "getItem"> | null = defaultLocal(),
): boolean {
  const map = readConsumed(storage);
  return Boolean(map[consumedMapKey(code)]);
}

export function markInstallJoinConsumed(
  code: string,
  storage: Pick<Storage, "getItem" | "setItem"> | null = defaultLocal(),
): void {
  if (!storage) return;
  const room = consumedMapKey(code);
  if (room.length !== 4) return;
  try {
    const map = readConsumed(storage);
    map[room] = Date.now();
    storage.setItem(INSTALL_JOIN_CONSUMED_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function readConsumed(
  storage: Pick<Storage, "getItem"> | null,
): Record<string, number> {
  if (!storage) return {};
  try {
    const raw = storage.getItem(INSTALL_JOIN_CONSUMED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, number>;
  } catch {
    return {};
  }
}

export async function fetchRoomExists(
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const room = normalizeRoomCode(code);
  if (room.length !== 4) return false;
  try {
    const res = await fetchImpl(`/api/room/${room}/exists`, {
      cache: "no-store",
    });
    if (!res.ok) return true;
    const data = (await res.json()) as { exists?: boolean };
    return data.exists !== false;
  } catch {
    return true;
  }
}

function defaultLocal(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function defaultSession(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

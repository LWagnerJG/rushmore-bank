/**
 * Device-stable client identity (no accounts).
 * Persisted redundantly: localStorage + IndexedDB + first-party cookie so
 * clearing one store does not mint a new id.
 */

const CLIENT_ID_KEY = "quarry:client-id";
const COOKIE_NAME = "beans_did";
const IDB_NAME = "beans-meta";
const IDB_STORE = "kv";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // ~13 months

function newClientId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split("; ");
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  const secure =
    typeof location !== "undefined" && location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

function openIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => {
        const v = req.result;
        resolve(typeof v === "string" ? v : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Write the id to every durable store we have. */
export function persistClientId(id: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLIENT_ID_KEY, id);
  } catch {
    /* ignore */
  }
  writeCookie(COOKIE_NAME, id);
  void idbSet(CLIENT_ID_KEY, id);
}

/**
 * Stable across tabs/rooms on this browser/device.
 * Sync path prefers localStorage (fast); hydrate from cookie/IDB if missing.
 */
export function getStableClientId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const existing = window.localStorage.getItem(CLIENT_ID_KEY);
    if (existing) {
      persistClientId(existing);
      return existing;
    }
  } catch {
    /* ignore */
  }

  const fromCookie = readCookie(COOKIE_NAME);
  if (fromCookie) {
    persistClientId(fromCookie);
    return fromCookie;
  }

  const id = newClientId();
  persistClientId(id);
  // Async IDB hydrate: if IDB had an older id, adopt it on next tick.
  void idbGet(CLIENT_ID_KEY).then((fromIdb) => {
    if (!fromIdb) return;
    try {
      const current = window.localStorage.getItem(CLIENT_ID_KEY);
      if (current && current !== fromIdb) {
        // Prefer the IDB id only when localStorage was freshly minted this session
        // and cookie was empty — already handled above. Keep current.
        return;
      }
      if (!current) persistClientId(fromIdb);
    } catch {
      /* ignore */
    }
  });
  return id;
}

/** Await full multi-store resolution (use on profile boot / merge checks). */
export async function resolveStableClientId(): Promise<string> {
  if (typeof window === "undefined") return "ssr";
  let id: string | null = null;
  try {
    id = window.localStorage.getItem(CLIENT_ID_KEY);
  } catch {
    id = null;
  }
  if (!id) id = readCookie(COOKIE_NAME);
  if (!id) id = await idbGet(CLIENT_ID_KEY);
  if (!id) id = newClientId();
  persistClientId(id);
  return id;
}

/** Call once on app boot so IDB can restore before a fresh id sticks. */
export async function hydrateStableClientId(): Promise<string> {
  return resolveStableClientId();
}

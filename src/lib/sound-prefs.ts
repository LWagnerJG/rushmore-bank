/**
 * Sound preference — OFF by default, persisted in localStorage.
 * Settings sheet toggle; SFX/haptics no-op until enabled.
 */

const KEY = "beans:sound-enabled";
const EVENT = "beans:sound-enabled";

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, enabled ? "1" : "0");
    window.dispatchEvent(
      new CustomEvent(EVENT, { detail: { enabled } }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function subscribeSoundEnabled(
  listener: (enabled: boolean) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener(e.newValue === "1");
  };
  const onCustom = (e: Event) => {
    const detail = (e as CustomEvent<{ enabled: boolean }>).detail;
    if (detail) listener(detail.enabled);
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, onCustom);
  };
}

/** Storage key — exported for tests. */
export const SOUND_ENABLED_KEY = KEY;

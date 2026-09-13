/**
 * Sound FX preference — persisted in localStorage, respected by dice SFX.
 */

const KEY = "beans:sfx-muted";

export function isSfxMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setSfxMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, muted ? "1" : "0");
    window.dispatchEvent(
      new CustomEvent("beans:sfx-muted", { detail: { muted } }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function subscribeSfxMuted(listener: (muted: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener(e.newValue === "1");
  };
  const onCustom = (e: Event) => {
    const detail = (e as CustomEvent<{ muted: boolean }>).detail;
    if (detail) listener(detail.muted);
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("beans:sfx-muted", onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("beans:sfx-muted", onCustom);
  };
}

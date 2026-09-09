/** Session flag set after home PIN unlock — UI-only; server still gates host redo. */
export const ADMIN_UNLOCK_KEY = "beans:admin-unlocked";

export function readAdminUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(ADMIN_UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

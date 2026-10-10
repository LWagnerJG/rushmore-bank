import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False on the server and while hydrating, true once mounted. Gate UI that
 * reads browser storage on it so the server HTML and first client render
 * match (no React #418) without a setState-in-effect.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

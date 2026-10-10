/**
 * Calls `onSecond` with the whole seconds left until `until` (epoch ms): once
 * now, then just after each second boundary, stopping once it reports 0.
 * Recomputes from the clock on every wake, so a late timer (iOS background)
 * jumps to the true value instead of drifting. Returns a cancel function.
 */
export function watchSecondsLeft(
  until: number | null,
  onSecond: (left: number) => void,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = () => {
    const ms = until ? until - Date.now() : 0;
    onSecond(ms > 0 ? Math.ceil(ms / 1000) : 0);
    if (ms > 0) timer = setTimeout(tick, (ms % 1000 || 1000) + 20);
  };
  tick();
  return () => clearTimeout(timer);
}

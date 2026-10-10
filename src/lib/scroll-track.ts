/**
 * Center a chip inside its horizontal scroll track, touching only the track's
 * scrollLeft. Element.scrollIntoView also scrolls every vertical ancestor
 * (the phase scroller, and on iOS the keyboard-panned page), which jumped the
 * draft field on every turn broadcast.
 */
export function centerInTrack(chip: HTMLElement, track: HTMLElement): void {
  const max = track.scrollWidth - track.clientWidth;
  if (max <= 0) return;
  const c = chip.getBoundingClientRect();
  const t = track.getBoundingClientRect();
  const target = Math.max(
    0,
    Math.min(
      max,
      track.scrollLeft + (c.left + c.width / 2) - (t.left + t.width / 2),
    ),
  );
  if (Math.abs(target - track.scrollLeft) < 1) return;
  track.scrollTo({ left: target, behavior: "auto" });
}

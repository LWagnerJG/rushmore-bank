/** Phone roster board density from seated player count. */
export function rosterDensity(count: number): "cozy" | "snug" | "dense" {
  if (count >= 8) return "dense";
  if (count >= 5) return "snug";
  return "cozy";
}

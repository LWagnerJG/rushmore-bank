/** Fair d6 via rejection sampling (avoids modulo bias). */

export function rollD6(rng: () => number = Math.random): number {
  // 2^32 space; take values < floor(2^32/6)*6
  const limit = Math.floor(0x100000000 / 6) * 6;
  for (let i = 0; i < 64; i++) {
    const x = Math.floor(rng() * 0x100000000);
    if (x < limit) return (x % 6) + 1;
  }
  // Extremely unlikely fallback
  return 1 + Math.floor(rng() * 6);
}

export function roll2d6(rng: () => number = Math.random): [number, number] {
  return [rollD6(rng), rollD6(rng)];
}

/** Deterministic RNG from string seed (mulberry32). */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(...parts: Array<string | number>): number {
  let h = 2166136261;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

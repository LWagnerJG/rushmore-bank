/**
 * Authoritative RNG for dice + seat order.
 *
 * Production paths use Web Crypto (`crypto.getRandomValues`) — never a fixed
 * seed, room code, round index, or player index. `mulberry32` / `hashSeed` are
 * only for tests and presentation scramble (not outcomes).
 */

/** 32-bit crypto sample. Works in Workers, browsers, and Node 22+. */
export function cryptoRandomUint32(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]!;
}

/** Uniform float in [0, 1) from crypto bits. */
export function cryptoRandom(): number {
  return cryptoRandomUint32() / 0x100000000;
}

/**
 * Uniform integer in `[0, bound)` via rejection sampling (no modulo bias).
 * `bound` must be an integer in `1..2^32`.
 */
export function randomInt(
  bound: number,
  randUint32: () => number = cryptoRandomUint32,
): number {
  const n = Math.floor(bound);
  if (!Number.isFinite(n) || n <= 0 || n > 0x100000000) {
    throw new Error("randomInt bound out of range");
  }
  if (n === 1) return 0;
  const limit = Math.floor(0x100000000 / n) * n;
  for (let i = 0; i < 64; i++) {
    const x = randUint32() >>> 0;
    if (x < limit) return x % n;
  }
  // Extremely unlikely fallback
  return randUint32() % n;
}

/** Fair d6 via rejection sampling (avoids modulo bias). */
export function rollD6(rng: () => number = cryptoRandom): number {
  // 2^32 space; take values < floor(2^32/6)*6
  const limit = Math.floor(0x100000000 / 6) * 6;
  for (let i = 0; i < 64; i++) {
    const x = Math.floor(rng() * 0x100000000);
    if (x < limit) return (x % 6) + 1;
  }
  // Extremely unlikely fallback
  return 1 + Math.floor(rng() * 6);
}

export function roll2d6(rng: () => number = cryptoRandom): [number, number] {
  return [rollD6(rng), rollD6(rng)];
}

/**
 * Fisher–Yates shuffle (crypto by default). Returns a new array.
 * Do not use `Array.sort(() => Math.random() - 0.5)` — that comparator is
 * inconsistent and heavily biased toward the input order on V8/TimSort.
 */
export function fisherYatesShuffle<T>(
  items: readonly T[],
  randUint32: () => number = cryptoRandomUint32,
): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, randUint32);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/** Deterministic RNG from numeric seed (mulberry32) — tests / scramble only. */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uint32 source derived from mulberry32 — for deterministic shuffle tests. */
export function mulberry32Uint32(seed: number): () => number {
  const rng = mulberry32(seed);
  return () => Math.floor(rng() * 0x100000000) >>> 0;
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

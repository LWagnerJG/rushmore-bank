/**
 * Funny themed bean avatars — lightweight inline SVG ids + palette.
 * Deterministic default from device id; players can override.
 */

export const BEAN_AVATAR_IDS = [
  "classic",
  "shades",
  "chef",
  "astro",
  "cowboy",
  "ghost",
  "pirate",
  "nerd",
  "crown",
  "flower",
  "mustache",
  "scarf",
  "devil",
  "angel",
  "sleepy",
  "spicy",
  "sport",
  "wizard",
  "robot",
  "bee",
] as const;

export type BeanAvatarId = (typeof BEAN_AVATAR_IDS)[number];

export const BEAN_AVATAR_LABELS: Record<BeanAvatarId, string> = {
  classic: "Classic bean",
  shades: "Cool shades",
  chef: "Chef bean",
  astro: "Astronaut",
  cowboy: "Cowboy",
  ghost: "Ghost bean",
  pirate: "Pirate",
  nerd: "Nerd bean",
  crown: "Royal bean",
  flower: "Flower power",
  mustache: "Mustache",
  scarf: "Winter scarf",
  devil: "Little devil",
  angel: "Angel bean",
  sleepy: "Sleepy",
  spicy: "Spicy",
  sport: "Sporty",
  wizard: "Wizard",
  robot: "Robot bean",
  bee: "Bee bean",
};

export function isBeanAvatarId(id: string | null | undefined): id is BeanAvatarId {
  return !!id && (BEAN_AVATAR_IDS as readonly string[]).includes(id);
}

/** Stable hash → avatar for a device / bot id. */
export function avatarIdFromSeed(seed: string): BeanAvatarId {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = Math.abs(h) % BEAN_AVATAR_IDS.length;
  return BEAN_AVATAR_IDS[idx]!;
}

export function normalizeAvatarId(
  id: string | null | undefined,
  fallbackSeed = "bean",
): BeanAvatarId {
  if (isBeanAvatarId(id)) return id;
  return avatarIdFromSeed(fallbackSeed);
}

/**
 * Themed bean avatars — WebP sprites in public/avatars/.
 * Deterministic default from device id; players can override in the profile sheet.
 */

export const BEAN_AVATAR_IDS = [
  "aviator",
  "grill",
  "headphones",
  "beanie",
  "star",
  "cyber-visor",
  "bow",
  "tiara",
  "perm",
  "boa",
  "unicorn",
  "spa",
  "viking",
  "cone",
  "top-hat",
  "tinfoil",
  "cake",
  "mullet",
  "clown",
  "fishbowl",
] as const;

export type BeanAvatarId = (typeof BEAN_AVATAR_IDS)[number];

export const BEAN_AVATAR_LABELS: Record<BeanAvatarId, string> = {
  aviator: "Aviator",
  grill: "Grill",
  headphones: "Headphones",
  beanie: "Beanie",
  star: "Star",
  "cyber-visor": "Cyber visor",
  bow: "Bow",
  tiara: "Tiara",
  perm: "Perm",
  boa: "Boa",
  unicorn: "Unicorn",
  spa: "Spa",
  viking: "Viking",
  cone: "Traffic cone",
  "top-hat": "Top hat",
  tinfoil: "Tinfoil hat",
  cake: "Cake",
  mullet: "Mullet",
  clown: "Clown",
  fishbowl: "Fishbowl",
};

/** Cache-bust when art is re-cropped / re-exported. */
const AVATAR_ASSET_VER = "7";

/** Public path for a bean avatar WebP. */
export function beanAvatarSrc(id: BeanAvatarId): string {
  return `/avatars/${id}.webp?v=${AVATAR_ASSET_VER}`;
}

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

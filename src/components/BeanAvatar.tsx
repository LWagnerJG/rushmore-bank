import {
  BEAN_AVATAR_LABELS,
  beanAvatarSrc,
  normalizeAvatarId,
  type BeanAvatarId,
} from "@/shared/bean-avatars";

/**
 * Crisp WebP bean avatar (from public/avatars/). Used in the profile button
 * and profile sheet picker only — not lobby/rail/standings.
 */
export function BeanAvatar({
  id,
  seed,
  size = 28,
  className = "",
}: {
  id?: string | null;
  seed?: string;
  size?: number;
  className?: string;
}) {
  const resolved: BeanAvatarId = normalizeAvatarId(id, seed ?? "bean");
  const label = BEAN_AVATAR_LABELS[resolved];
  return (
    <span
      className={`bean-avatar ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden="true"
      title={label}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- small static WebP set */}
      <img
        src={beanAvatarSrc(resolved)}
        alt=""
        width={size}
        height={size}
        draggable={false}
        decoding="async"
      />
    </span>
  );
}

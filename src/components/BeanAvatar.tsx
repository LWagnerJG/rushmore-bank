import {
  BEAN_AVATAR_LABELS,
  normalizeAvatarId,
  type BeanAvatarId,
} from "@/shared/bean-avatars";

/** Cream/green/coral palette — matches Beans UI. */
const C = {
  body: "#6B8F71",
  bodyDeep: "#4F7358",
  highlight: "#A7D7C2",
  cream: "#FFF8EC",
  coral: "#E76F4E",
  ink: "#23483E",
  gold: "#E0B44A",
  soft: "#F4C95B",
};

function Accessory({ id }: { id: BeanAvatarId }) {
  switch (id) {
    case "shades":
      return (
        <g>
          <rect x="10" y="14" width="12" height="5" rx="1.5" fill={C.ink} />
          <rect x="22" y="14" width="12" height="5" rx="1.5" fill={C.ink} />
          <path d="M22 16.5h2" stroke={C.ink} strokeWidth="1.5" />
        </g>
      );
    case "chef":
      return (
        <g>
          <ellipse cx="22" cy="8" rx="11" ry="6" fill={C.cream} />
          <rect x="14" y="10" width="16" height="4" rx="1" fill={C.cream} />
        </g>
      );
    case "astro":
      return (
        <g>
          <circle cx="22" cy="16" r="12" fill="none" stroke={C.ink} strokeWidth="2.2" />
          <circle cx="22" cy="16" r="9" fill={C.highlight} opacity="0.35" />
        </g>
      );
    case "cowboy":
      return (
        <g>
          <ellipse cx="22" cy="11" rx="14" ry="3" fill={C.coral} />
          <path d="M12 11c2-6 18-6 20 0" fill={C.coral} />
        </g>
      );
    case "ghost":
      return (
        <g opacity="0.9">
          <path
            d="M10 18c0-8 5-12 12-12s12 4 12 12v10l-4-3-4 3-4-3-4 3-4-3-4 3V18z"
            fill={C.cream}
          />
          <circle cx="17" cy="18" r="1.4" fill={C.ink} />
          <circle cx="27" cy="18" r="1.4" fill={C.ink} />
        </g>
      );
    case "pirate":
      return (
        <g>
          <path d="M8 13h28" stroke={C.ink} strokeWidth="3" />
          <circle cx="16" cy="16" r="3.2" fill={C.ink} />
          <path d="M28 28c2 3 6 4 8 3" stroke={C.coral} strokeWidth="1.6" fill="none" />
        </g>
      );
    case "nerd":
      return (
        <g>
          <circle cx="16" cy="16" r="4.2" fill="none" stroke={C.ink} strokeWidth="1.6" />
          <circle cx="28" cy="16" r="4.2" fill="none" stroke={C.ink} strokeWidth="1.6" />
          <path d="M20.2 16h3.6" stroke={C.ink} strokeWidth="1.6" />
        </g>
      );
    case "crown":
      return (
        <path
          d="M12 14l3-6 4 4 3-7 3 7 4-4 3 6v3H12v-3z"
          fill={C.gold}
        />
      );
    case "flower":
      return (
        <g>
          <circle cx="30" cy="10" r="3" fill={C.coral} />
          <circle cx="33" cy="12" r="3" fill={C.soft} />
          <circle cx="27" cy="12" r="3" fill={C.soft} />
          <circle cx="30" cy="12" r="1.6" fill={C.cream} />
        </g>
      );
    case "mustache":
      return (
        <path
          d="M14 24c3-3 6-2 8 0 2-2 5-3 8 0-3 2-6 2-8 0-2 2-5 2-8 0z"
          fill={C.ink}
        />
      );
    case "scarf":
      return (
        <g>
          <path d="M12 26c6 4 14 4 20 0" stroke={C.coral} strokeWidth="3.5" fill="none" />
          <path d="M26 28l4 8" stroke={C.coral} strokeWidth="2.5" />
        </g>
      );
    case "devil":
      return (
        <g>
          <path d="M12 12l-3-7 6 3" fill={C.coral} />
          <path d="M32 12l3-7-6 3" fill={C.coral} />
          <path d="M30 28c3 2 6 2 8 0" stroke={C.coral} strokeWidth="1.5" fill="none" />
        </g>
      );
    case "angel":
      return (
        <g>
          <ellipse cx="10" cy="18" rx="5" ry="3" fill={C.cream} opacity="0.9" />
          <ellipse cx="34" cy="18" rx="5" ry="3" fill={C.cream} opacity="0.9" />
          <ellipse cx="22" cy="7" rx="6" ry="2.2" fill="none" stroke={C.gold} strokeWidth="1.5" />
        </g>
      );
    case "sleepy":
      return (
        <g>
          <path d="M13 16c2 2 5 2 7 0" stroke={C.ink} strokeWidth="1.6" fill="none" />
          <path d="M24 16c2 2 5 2 7 0" stroke={C.ink} strokeWidth="1.6" fill="none" />
          <text x="31" y="12" fontSize="7" fill={C.ink}>
            z
          </text>
        </g>
      );
    case "spicy":
      return (
        <g>
          <path d="M31 8c4 2 5 8 2 12-4-2-5-8-2-12z" fill={C.coral} />
          <path d="M33 7c1-2 3-3 4-2" stroke={C.bodyDeep} strokeWidth="1.4" fill="none" />
        </g>
      );
    case "sport":
      return (
        <g>
          <path d="M10 12h24" stroke={C.ink} strokeWidth="2.5" />
          <path d="M14 12v-3h16v3" fill={C.coral} />
        </g>
      );
    case "wizard":
      return (
        <g>
          <path d="M14 14L22 2l8 12H14z" fill="#5C6BC0" />
          <circle cx="22" cy="8" r="1.3" fill={C.soft} />
        </g>
      );
    case "robot":
      return (
        <g>
          <rect x="13" y="11" width="18" height="12" rx="2" fill={C.ink} opacity="0.15" />
          <rect x="16" y="14" width="4" height="3" fill={C.coral} />
          <rect x="24" y="14" width="4" height="3" fill={C.coral} />
          <path d="M22 8v3" stroke={C.ink} strokeWidth="1.5" />
          <circle cx="22" cy="7" r="1.4" fill={C.ink} />
        </g>
      );
    case "bee":
      return (
        <g>
          <ellipse cx="11" cy="16" rx="4" ry="2.5" fill={C.cream} opacity="0.85" />
          <ellipse cx="33" cy="16" rx="4" ry="2.5" fill={C.cream} opacity="0.85" />
          <path d="M14 20h16" stroke={C.soft} strokeWidth="2" />
          <path d="M14 24h16" stroke={C.soft} strokeWidth="2" />
        </g>
      );
    default:
      return null;
  }
}

/**
 * Small crisp bean character. Uses currentColor-free fills from the Beans palette.
 */
export function BeanAvatar({
  id,
  seed,
  size = 28,
  className,
  title,
}: {
  id?: string | null;
  /** Used when id is missing — typically device or player id. */
  seed?: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  const avatarId = normalizeAvatarId(id, seed ?? "bean");
  const label = title ?? BEAN_AVATAR_LABELS[avatarId];
  const hideFace = avatarId === "ghost";

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 44 44"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      {/* Bean body */}
      <ellipse cx="22" cy="24" rx="14" ry="16" fill={C.body} />
      <ellipse cx="17" cy="18" rx="5" ry="7" fill={C.highlight} opacity="0.35" />
      {!hideFace ? (
        <g>
          <circle cx="16.5" cy="22" r="1.6" fill={C.ink} />
          <circle cx="27.5" cy="22" r="1.6" fill={C.ink} />
          <path
            d="M17 28c2.5 2 7.5 2 10 0"
            stroke={C.ink}
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      ) : null}
      <Accessory id={avatarId} />
    </svg>
  );
}

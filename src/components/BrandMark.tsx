import { memo } from "react";

/**
 * Shared Beans logo.
 * - Default / chrome: compact 30px mark (lobby + in-game)
 * - hero: large home brand moment with a slow diagonal glisten
 */
export const BrandMark = memo(function BrandMark({
  /**
   * @deprecated Prefer `hero` for the home mark. Kept for call-site compat.
   */
  large = false,
  /**
   * Quiet in-room chrome styling (muted wordmark). Same compact size.
   */
  chrome = false,
  /**
   * Home hero — large icon + wordmark with a slow shine sweep.
   */
  hero = false,
  /**
   * Gradient clipped-text shimmer on the wordmark (home only).
   * MUST stay off in room chrome.
   */
  shimmer = true,
  onLogoTap,
}: {
  large?: boolean;
  chrome?: boolean;
  hero?: boolean;
  shimmer?: boolean;
  /** Fired when the bean icon is tapped (not the wordmark). */
  onLogoTap?: () => void;
}) {
  const isHero = hero || large;
  const wordClass = chrome
    ? "brand-mark-word brand-mark-chrome-word"
    : "brand-mark-word font-[family-name:var(--font-display)] font-extrabold tracking-tight " +
      (isHero ? "brand-mark-hero-word " : "") +
      (shimmer && !isHero ? "brand-shimmer " : "") +
      (shimmer && isHero ? "text-[var(--text)] " : "") +
      (!shimmer ? "text-[var(--text)] " : "");

  const iconSize = isHero ? 88 : 30;

  return (
    <div
      className={
        "brand-mark inline-flex items-center gap-[0.45rem] " +
        (isHero ? "brand-mark-hero gap-[0.65rem] " : "") +
        (chrome ? "brand-mark-chrome " : "") +
        (shimmer && !isHero ? "" : "room-brand-mark-static ")
      }
      aria-label="Beans"
    >
      <button
        type="button"
        className={
          (onLogoTap
            ? "room-brand-logo-btn outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--coral)] focus-visible:outline-offset-2 "
            : "pointer-events-none ") +
          (isHero ? "brand-mark-hero-shine" : "")
        }
        tabIndex={onLogoTap ? 0 : -1}
        aria-hidden={!onLogoTap}
        aria-label={onLogoTap ? "Beans logo" : undefined}
        onClick={onLogoTap}
      >
        <svg
          className={
            "brand-mark-icon" + (isHero ? " brand-mark-hero-icon" : "")
          }
          viewBox="0 0 128 128"
          width={iconSize}
          height={iconSize}
          aria-hidden="true"
          style={{ display: "block" }}
          shapeRendering="auto"
        >
          <path
            d="M85 13C109 15 122 39 112 60C106 73 92 71 89 85C85 110 61 123 38 111C11 97 10 61 25 38C40 17 63 10 85 13Z"
            fill="#E76F4E"
            stroke="#23483E"
            strokeWidth="6"
          />
          <path
            d="M41 36C50 27 59 24 69 24"
            fill="none"
            stroke="#FFDFA5"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <ellipse cx="47" cy="62" rx="4" ry="6" fill="#23483E" />
          <ellipse cx="65" cy="58" rx="4" ry="6" fill="#23483E" />
          <path
            d="M49 78Q60 87 69 74"
            fill="none"
            stroke="#23483E"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <span className={wordClass}>Beans</span>
    </div>
  );
});

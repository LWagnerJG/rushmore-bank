/**
 * Shared Beans logo — one size on every screen (home, lobby, in-game).
 * Icon via --brand-icon-size (30px); wordmark via --brand-word-size.
 */
export function BrandMark({
  /**
   * @deprecated Kept for call-site compat; size is always the shared token.
   */
  large: _large = false,
  /**
   * Quiet in-room chrome styling (muted wordmark). Same size as home.
   */
  chrome = false,
  /**
   * Gradient clipped-text shimmer. MUST stay off in room chrome — animated
   * `background-clip: text` soft-rasterizes the whole header band on iOS.
   */
  shimmer = true,
  onLogoTap,
}: {
  large?: boolean;
  chrome?: boolean;
  shimmer?: boolean;
  /** Fired when the bean icon is tapped (not the wordmark). */
  onLogoTap?: () => void;
}) {
  void _large;
  const wordClass = chrome
    ? "brand-mark-word brand-mark-chrome-word"
    : "brand-mark-word font-[family-name:var(--font-display)] font-extrabold tracking-tight " +
      (shimmer ? "brand-shimmer " : "text-[var(--text)] ");

  return (
    <div
      className={
        "brand-mark inline-flex items-center gap-[0.45rem] " +
        (chrome ? "brand-mark-chrome" : "") +
        (shimmer ? "" : " room-brand-mark-static")
      }
      aria-label="Beans"
    >
      <button
        type="button"
        className={
          onLogoTap
            ? // Avoid rounded-full + ring box-shadow promoting a soft chrome layer
              "room-brand-logo-btn outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--coral)] focus-visible:outline-offset-2"
            : "pointer-events-none"
        }
        tabIndex={onLogoTap ? 0 : -1}
        aria-hidden={!onLogoTap}
        aria-label={onLogoTap ? "Beans logo" : undefined}
        onClick={onLogoTap}
      >
        <svg
          className="brand-mark-icon"
          viewBox="0 0 128 128"
          width={30}
          height={30}
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
}

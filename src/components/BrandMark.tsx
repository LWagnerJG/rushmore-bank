export function BrandMark({
  large = false,
  onLogoTap,
}: {
  large?: boolean;
  /** Fired when the bean icon is tapped (not the wordmark). */
  onLogoTap?: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-3" aria-label="Beans">
      <button
        type="button"
        className={
          onLogoTap
            ? "rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]"
            : "pointer-events-none"
        }
        tabIndex={onLogoTap ? 0 : -1}
        aria-hidden={!onLogoTap}
        aria-label={onLogoTap ? "Beans logo" : undefined}
        onClick={onLogoTap}
      >
        <svg
          viewBox="0 0 128 128"
          width={large ? 72 : 36}
          height={large ? 72 : 36}
          aria-hidden="true"
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
      <span
        className={
          "font-[family-name:var(--font-display)] font-extrabold tracking-tight brand-shimmer " +
          (large ? "text-6xl" : "text-2xl")
        }
      >
        Beans
      </span>
    </div>
  );
}

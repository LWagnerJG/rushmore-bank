"use client";

import type { ReactNode } from "react";
import type { DraftPick } from "@/shared/types";
import { RULES } from "@/shared/rules";

/** Premium Mount Rushmore roster card — cream panel, clear hierarchy, always-on why. */
export function RushmoreCard({
  name,
  picks,
  why,
  selected,
  interactive,
  disabled,
  onSelect,
  footer,
  badge,
  compact,
  density = "cozy",
}: {
  name: string;
  picks: DraftPick[];
  why?: string | null;
  selected?: boolean;
  interactive?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  footer?: ReactNode;
  badge?: ReactNode;
  compact?: boolean;
  density?: "cozy" | "snug" | "dense";
}) {
  const sorted = [...picks]
    .sort((a, b) => a.pickIndex - b.pickIndex)
    .slice(0, RULES.picksPerPlayer);
  const dens = compact && density === "cozy" ? "snug" : density;
  const whyText = why?.trim() ?? "";
  const hasWhy = whyText.length > 0;
  const votePicked = !!selected;

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p
          className={`rushmore-card-name font-[family-name:var(--font-display)] font-extrabold leading-tight ${
            dens === "dense"
              ? "text-base"
              : dens === "snug"
                ? "text-[1.05rem]"
                : "text-lg"
          }`}
        >
          {name}
        </p>
        {votePicked ? (
          <span className="rushmore-vote-badge" aria-hidden="true">
            ✓ Your vote
          </span>
        ) : (
          badge
        )}
      </div>
      <ol className={`rushmore-list rushmore-list-${dens}`}>
        {sorted.map((pk, i) => (
          <li key={pk.turnIndex} className="rushmore-list-item">
            <span className="rushmore-list-num" aria-hidden="true">
              {i + 1}
            </span>
            <span className="rushmore-list-text">{pk.text}</span>
          </li>
        ))}
      </ol>
      {hasWhy ? <p className="rushmore-why">{whyText}</p> : null}
      {footer}
    </>
  );

  if (interactive) {
    return (
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-pressed={!!selected}
        aria-disabled={disabled || undefined}
        className={[
          "panel",
          "rushmore-card",
          `rushmore-card-${dens}`,
          "rushmore-card-your-turn",
          "w-full",
          "text-left",
          selected ? "rushmore-card-selected" : "",
          disabled ? "rushmore-card-disabled" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => {
          if (disabled) return;
          onSelect?.();
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect?.();
          }
        }}
      >
        {body}
      </div>
    );
  }

  return (
    <article
      className={`panel rushmore-card rushmore-card-${dens} ${
        selected ? "rushmore-card-selected" : ""
      }`}
    >
      {body}
    </article>
  );
}

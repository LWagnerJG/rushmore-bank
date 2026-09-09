"use client";

import type { ReactNode } from "react";
import type { DraftPick } from "@/shared/types";
import { RULES } from "@/shared/rules";

/** Premium Mount Rushmore roster card — cream panel, clear hierarchy, optional why. */
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
          {selected ? " ✓" : ""}
        </p>
        {badge}
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
      {why ? <p className="rushmore-why">{why}</p> : null}
      {footer}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        className={`panel rushmore-card rushmore-card-${dens} w-full text-left transition ${
          selected ? "rushmore-card-selected" : ""
        }`}
        disabled={disabled}
        onClick={onSelect}
      >
        {body}
      </button>
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

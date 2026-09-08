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
}) {
  const sorted = [...picks]
    .sort((a, b) => a.pickIndex - b.pickIndex)
    .slice(0, RULES.picksPerPlayer);

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="font-[family-name:var(--font-display)] text-lg font-extrabold leading-tight">
          {name}
          {selected ? " ✓" : ""}
        </p>
        {badge}
      </div>
      <ol className="rushmore-list mt-2.5">
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
        className={`panel rushmore-card w-full text-left transition ${
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
      className={`panel rushmore-card ${selected ? "rushmore-card-selected" : ""}`}
    >
      {body}
    </article>
  );
}

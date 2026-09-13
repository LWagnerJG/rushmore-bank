import Link from "next/link";
import { RULES } from "@/shared/rules";

const COMMIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA;
const COMMIT_MESSAGE = process.env.VERCEL_GIT_COMMIT_MESSAGE;

export default function BuildNotesPage() {
  const shortSha = COMMIT_SHA ? COMMIT_SHA.slice(0, 7) : null;

  return (
    <main className="app-shell app-shell-scroll mx-auto max-w-md space-y-6 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <Link href="/" className="text-sm font-bold text-[var(--coral)]">
        ← Home
      </Link>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">
        Build notes
      </h1>
      <p className="rounded-xl bg-[rgba(167,215,194,0.45)] px-3 py-2 text-sm font-extrabold">
        Lobby Topic vibes scroll fix → {RULES.productionUrl}
      </p>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">This build</h2>
        {COMMIT_SHA ? (
          <ul className="list-disc space-y-1 pl-5">
            <li>
              SHA: <code className="break-all">{COMMIT_SHA}</code> ({shortSha})
            </li>
            {COMMIT_MESSAGE ? (
              <li>
                Message: <span className="italic">{COMMIT_MESSAGE}</span>
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="text-[var(--muted)]">
            Commit SHA appears on Vercel via{" "}
            <code>VERCEL_GIT_COMMIT_SHA</code>.
          </p>
        )}
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">What shipped</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Lobby Topic vibes clip</strong>: room shell is locked again;
            phase content scrolls in <code>.room-phase-scroll</code> under the
            chrome. Safe-area padding sits on the scroll content (true inset
            only — no fake cream block).{" "}
            <code>animate-rise</code> no longer leaves a transform that trapped
            overflow; lobby panels are <code>shrink-0</code> so Geography +
            helper copy + card chrome scroll fully into view. Admin FAB still
            clears via <code>.lobby-start-slot</code>.
          </li>
          <li>
            <strong>Unchanged</strong>: NoPullToRefresh, nickname-first home,
            Join card, Party Mode, 5-tap admin.
          </li>
          <li>
            <strong>Wager slider</strong>: one unified track (orange AT RISK
            from the left, green stay-safe on the right) — no separate ratio
            bar, no flipped colors. Pointer capture +{" "}
            <code>touch-action: none</code> so vertical finger drift doesn’t
            drop the drag on iOS.
          </li>
          <li>
            Loud 45s timer, min 1 / max earned+banked, Admin, and player rail
            unchanged. No rule or PartyKit changes.
          </li>
          <li>
            <strong>Player rail · few seats</strong>: 2–3 player chips grow
            wider/taller (duo/trio sizes) so the top row doesn’t look sparse.
            Pot-split Safe/Risking still shares the row; 6+ densify/scroll as
            before. You highlight/glow stays unclipped; Ready to wager under
            the rail unchanged.
          </li>
          <li>
            <strong>Score reveal header</strong>: dropped redundant top-right
            Scores + beans readout — player rail already shows totals
            (+earned). Logo left stays; Ready to wager under the rail
            unchanged. Other phases keep phase label / balance for
            orientation.
          </li>
          <li>
            <strong>Viewport paint (final)</strong>: two-layer approach — html
            background-color equals the gradient last stop (#ebe4d6 / party
            #f5d9c8) so any unrendered pixel is seamless; body::before fixed
            layer extends 50 px below the viewport (<code>bottom:-50px</code>)
            to cover the home-indicator safe-area. The gradient fills the full
            element (no <code>background-size</code> restriction) so the
            50 px overhang is a continuous gradient tail with no visible seam.
          </li>
        </ul>
      </section>
    </main>
  );
}

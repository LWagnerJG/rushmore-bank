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
        Score breakdown + draft turn-count fix → {RULES.productionUrl}
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
<strong>Score breakdown</strong>: each card now shows{" "}
            <code>20 base + N AI + N votes</code> so the components add up to
            the displayed total. Neutral AI fallback is flagged with{" "}
            <code>*</code>.
          </li>
          <li>
            <strong>Draft turn counter</strong>: &ldquo;You&rsquo;re up in N&rdquo;
            now shows the distance from the current cursor (not the absolute
            snake-order index). &ldquo;You&rsquo;re next&rdquo; appears when the
            distance is exactly 1. Works in both snake directions and the
            correction phase.
          </li>
          <li>
            <strong>Draft rail order</strong>: player chips now follow the
            draft board&apos;s left-to-right seat columns during DRAFT and
            CORRECTION; score-focused phases keep leaderboard ordering. The
            redundant Draft header subtitle is gone.
          </li>
          <li>
            <strong>Lobby player rail</strong>: hidden the redundant top
            scoreboard before the game starts; in-game phases still show it.
          </li>
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
            <code>touch-action: none</code> so vertical finger drift doesn&apos;t
            drop the drag on iOS.
          </li>
          <li>
            Loud 45s timer, min 1 / max earned+banked, Admin, and player rail
            unchanged. No rule or PartyKit changes.
          </li>
          <li>
            <strong>Player rail · few seats</strong>: 2–3 player chips grow
            wider/taller (duo/trio sizes) so the top row doesn&apos;t look sparse.
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
            <strong>Viewport height fix</strong>: in iOS PWA (Add to Home
            Screen), <code>100dvh</code> maps to the layout viewport which
            can be shorter than the real visual extent by the status-bar
            height (~47–59 px). <code>NoPullToRefresh</code> now writes{" "}
            <code>--app-h</code> from <code>window.innerHeight</code> on
            mount and on resize; <code>html</code>, <code>body</code>, and{" "}
            <code>.app-shell</code> use <code>var(--app-h, 100dvh)</code> so
            all <code>overflow:hidden</code> clipping boundaries match the
            actual visible area — fixing the Start CTA slice.
          </li>
          <li>
            <strong>Viewport paint</strong>: body::before fixed layer
            (z-index:-1, bottom:-50px) covers the visual viewport and the
            home-indicator safe-area region. Gradient last stop equals{" "}
            <code>var(--bg)</code> so no warm strip appears at the bottom.
          </li>
        </ul>
      </section>
    </main>
  );
}

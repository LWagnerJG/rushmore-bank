import Link from "next/link";
import { RULES } from "@/shared/rules";
import { TOPIC_COUNT } from "@/shared/topics";

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
        Polish + reconnect + dice hierarchy → {RULES.productionUrl}
      </p>
      <p className="text-sm text-[var(--muted)]">
        Public handoff — no secrets, credentials, or private session data.
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
            <li>
              Target: production <code>roundacats.vercel.app</code> via merge to{" "}
              <code>main</code>. PartyKit redeploy required for reconnect/leave/rejoin server changes — also when{" "}
              <code>src/shared</code> / review+vote timers change.
            </li>
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
            <strong>Name cutoff</strong>: player rail / draft headers / dice turn
            chips use 2-line clamp + full-name <code>title</code> tooltips so long
            nicknames stay readable on phones instead of ugly mid-word cuts.
          </li>
          <li>
            <strong>Reconnect + auto-rejoin</strong>: PartySocket backoff tightened;
            visibility / online / pageshow forces a prompt reconnect. Room membership
            remembered in session+local storage — returning from another app auto-rejoins
            the same seat (id reclaim) without hunting for Rejoin. Host{" "}
            <code>CODE · AB12</code> share affordance kept. Soft-disconnect grace (~8s)
            still holds the seat; reclaim cancels it immediately on matching connect.
          </li>
          <li>
            <strong>Dice vs Bank hierarchy</strong>: tap-the-dice is the primary action
            (bigger armed tray, <code>TAP TO ROLL</code>, stronger first-roll pulse).
            Bank is demoted to a quiet outline secondary control — still reachable in
            the 15s window, no longer the fat-finger coral CTA. Scramble settle honesty
            + BEAN BUSTER clarity preserved.
          </li>
          <li>
            <strong>Pot vs safe</strong>: your pot (at risk) vs safe always labeled on
            the dice panel; during wager/dice the player rail and turn strip show each
            seat&apos;s safe + pot at a glance.
          </li>
          <li>
            <strong>Min wager 1</strong>: cannot lock in 0 when you have beans
            (UI clamp + server validation). Timeout defaults to 1 when max ≥ 1.
            Empty balance (E+B=0) skips dice cleanly — no infinite roll loop.
          </li>
          <li>
            <strong>Leave / host / rejoin</strong>: lobby leave shrinks
            headcount. Mid-game soft-disconnect keeps the seat (~8s grace for
            app switch), promotes host, skips draft/vote/wager/dice waits, and
            supports rejoin (same id or nickname reclaim). Host gets a tiny
            in-game <code>CODE · AB12</code> (tap to copy).
          </li>
          <li>
            <strong>Draft board fit</strong>: at 2–5 players the Rushmore board
            shares phone width with no horizontal scroll; 6–10 may densify /
            scroll. Denser cells + active column tint kept.
          </li>
          <li>
            <strong>Top rail up-seat</strong>: current picker chip lights up
            (yellow ring / fill) during draft — not only “You”. You-first
            leaderboard sort kept.
          </li>
          <li>
            <strong>Redo gated</strong>: regular players see none. Host gets a
            tiny ↻; admin unlock shows a discrete lowercase redo link. No more
            big all-caps REDO under every cell.
          </li>
          <li>
            <strong>Rosters density</strong>: review board shrinks by player
            count (2-col dense for large groups).
          </li>
          <li>
            <strong>Vote flow</strong>: review auto-starts voting after{" "}
            {RULES.reviewSeconds}s (host “Start voting now” demoted); window{" "}
            {RULES.humanVoteSeconds}s or until all voted; clear{" "}
            <code>N/M voted</code>.
          </li>
          <li>
            Clocks: draft {RULES.pickClockSeconds}s +{" "}
            {RULES.pickGraceSeconds}s grace; review {RULES.reviewSeconds}s;
            vote {RULES.humanVoteSeconds}s; wager {RULES.wagerTimeoutSeconds}
            s; dice idle bank {RULES.diceIdleBankSeconds}s; topic still no
            timer.
          </li>
          <li>
            Preserved: Stash, topic bank (~{TOPIC_COUNT}), dice polish, Beans
            branding, admin PIN, bots.
          </li>
        </ul>
      </section>
    </main>
  );
}

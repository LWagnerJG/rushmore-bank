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
        Dice layout stable → {RULES.productionUrl}
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
              <code>main</code>. UI-only — no PartyKit redeploy required.
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
            <strong>Stable dice layout</strong>: reserved fixed regions (turn
            strip, who’s-up + status, 15s timer, dice tray, last-roll readout,
            pot/Bank CTA, personal safe beans) with consistent min-heights so
            the tray no longer leaps between watching / your turn / rolling /
            settled / bust / next seat.
          </li>
          <li>
            <strong>Numbers persist</strong>: pot, safe beans, last roll total,
            and strip pots stay mounted. Sticky last-roll survives scramble
            (faces stay honest on the tray); idle timer shows — instead of
            unmounting.
          </li>
          <li>
            <strong>Smooth transitions</strong>: opacity / grid-row motion for
            timer idle↔live, result freshness, party prompt open/close, and
            dimming — not abrupt mount/unmount.
          </li>
          <li>
            Preserved: <strong>BEAN BUSTER</strong> clears on next seat (server
            nulls <code>lastDice</code>; UI bust only while{" "}
            <code>SETTLED</code>), no pre-roll countdown,{" "}
            {RULES.diceIdleBankSeconds}s roll/Bank only, coral Bank CTA,
            tap-to-roll, scramble settle, turn strip, personal BANK.
          </li>
          <li>
            Clocks: draft {RULES.pickClockSeconds}s +{" "}
            {RULES.pickGraceSeconds}s grace; review {RULES.reviewSeconds}s;
            vote {RULES.humanVoteSeconds}s; wager {RULES.wagerTimeoutSeconds}
            s; dice idle bank {RULES.diceIdleBankSeconds}s; topic still no
            timer.
          </li>
          <li>
            Topics ~{TOPIC_COUNT} + anti-repeat, green perimeter when up, Stash,
            Beans branding.
          </li>
        </ul>
      </section>
    </main>
  );
}

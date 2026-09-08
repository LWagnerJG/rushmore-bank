import Link from "next/link";
import { RULES } from "@/shared/rules";

const COMMIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA;
const COMMIT_MESSAGE = process.env.VERCEL_GIT_COMMIT_MESSAGE;

export default function BuildNotesPage() {
  const shortSha = COMMIT_SHA ? COMMIT_SHA.slice(0, 7) : null;

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 pb-8 pt-[max(2rem,env(safe-area-inset-top))]">
      <Link href="/" className="text-sm font-bold text-[var(--coral)]">
        ← Home
      </Link>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">
        Build notes
      </h1>
      <p className="rounded-xl bg-[rgba(167,215,194,0.45)] px-3 py-2 text-sm font-extrabold">
        BANK dice layout polish (turn strip, no TABLE) → {RULES.productionUrl}
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
              <code>main</code>. PartyKit host{" "}
              <code>rushmore-bank.lwagnerjg.partykit.dev</code>.
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
            <strong>No “TABLE” label</strong>: removed the center circle hub
            entirely. The word Table never appears on the BANK dice screen.
          </li>
          <li>
            <strong>Layout choice — compact horizontal turn strip</strong>:
            replaced the awkward vertical circle seats with a scrollable chip
            strip (UP / NEXT / In / Banked / Bust + pots). Seat order reads
            left→right; the UP chip auto-centers. Phone-first and less clunky
            than forcing a round table.
          </li>
          <li>
            <strong>Tighter hierarchy</strong>: turn strip → who’s up → big
            timer → dice hero → pot + Bank. One dice stage, less stacked fluff,
            smaller result readout, tighter gaps.
          </li>
          <li>
            Preserved: scramble anticipation + hard-cut settle (no jump), 15s
            roll/Bank timer, tap-to-roll, BEAN BUSTER, personal BANK, green
            perimeter when you’re up, haptics/SFX.
          </li>
          <li>
            UI-only — no <code>party/</code> or RULES changes; PartyKit redeploy
            not required for this polish.
          </li>
        </ul>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Still true from prior BANK dice work</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Scramble faces are cosmetic; first settled frame paints server{" "}
            <code>d1</code>/<code>d2</code> with no coast/jump.
          </li>
          <li>
            <code>RULES.diceIdleBankSeconds = 15</code>; opening decision
            countdown stays 5s.
          </li>
        </ul>
      </section>
    </main>
  );
}

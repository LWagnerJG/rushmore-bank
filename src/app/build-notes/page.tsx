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
        BANK dice scramble + circle + 15s timer → {RULES.productionUrl}
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
            <strong>Scramble anticipation</strong>: while tumbling, 2D pip dice
            rapidly flip faces (seed-synced). First settled frame hard-cuts to
            server <code>d1</code>/<code>d2</code> — no blank shells, no coast
            to a fake face, no settle jump. Covered by{" "}
            <code>verify:dice</code>, <code>dice-scramble.test.ts</code>,{" "}
            <code>/dev/dice-lab</code>.
          </li>
          <li>
            <strong>15s roll/Bank window</strong>:{" "}
            <code>RULES.diceIdleBankSeconds = 15</code> (was 10). Opening
            decision countdown stays 5s. Draft pick clock stays 60s. Big timer
            UI on BANK.
          </li>
          <li>
            <strong>Players in a circle</strong>: turn order reads around the
            table (up / next / banked / bust). Header player rail hidden during
            DICE to cut chrome.
          </li>
          <li>
            Layout compartments: circle → timer → dice hero → pot + Bank.
            On-brand cream/mint/coral pip dice.
          </li>
          <li>
            Preserved: personal BANK, tap-to-roll, BEAN BUSTER on any 7, synced
            multiplayer, haptics/SFX, mint glow when you’re up, no mute toggle.
          </li>
          <li>
            <strong>PartyKit redeploy required</strong> — idle bank timer is
            server-enforced via <code>RULES</code>.
          </li>
        </ul>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">How scramble avoids the jump</h2>
        <p>
          Scramble faces are cosmetic only and never written to tray{" "}
          <code>data-dice-d1/d2</code>. When the broadcast reveals, the UI stops
          the scramble interval and paints auth faces in the same frame — no
          lerp from the last scramble value.
        </p>
      </section>
    </main>
  );
}

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
        Dice settle fail-proof → {RULES.productionUrl}
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
            <strong>Dice settle fail-proof</strong> — tumble is cosmetic only and
            never coasts into a readable rest pose. Final faces paint once from
            authoritative server <code>d1</code>/<code>d2</code> (no local/seed
            “fake settle” then jump). Regression coverage in{" "}
            <code>dice-settle.test.ts</code>.
          </li>
          <li>
            Root cause: near-end tumble decay froze a seed-driven wrong face,
            then reveal snapped to the real outcome.
          </li>
          <li>
            Preserved: personal BANK, tap-to-roll, BEAN BUSTER on any 7, synced
            multiplayer, haptics/SFX, full-phone mint glow when you’re up.
          </li>
          <li>
            <strong>No PartyKit redeploy</strong> — client presentation only (
            <code>DiceScene</code> + shared present helpers). Prior vote/wager/
            BANK polish and void-topic gate unchanged.
          </li>
        </ul>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Follow-ups</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            If PartyKit secrets are missing, Actions{" "}
            <code>deploy:party</code> may still fail — not required for this
            dice UX fix.
          </li>
        </ul>
      </section>
    </main>
  );
}

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
        2D dice — no settle jump → {RULES.productionUrl}
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
            <strong>Root cause</strong>: the 3D orthographic tumble always showed
            some readable face toward the camera. Even with “cosmetic only”
            spin + capped progress, that face was readable near the end, then
            reveal snapped to server <code>d1</code>/<code>d2</code> — a visible
            jump. The prior seed-coast diagnosis was incomplete; face-mapping /
            rest matrices were not the bug.
          </li>
          <li>
            <strong>Fix</strong>: replaced <code>DiceScene</code> with flat 2D
            pip dice. Tumble = blank/blurred shells (no readable face). First
            settled frame paints authoritative server faces only — no 3D
            projection, no seed rest pose, no morph.
          </li>
          <li>
            Invariant: from the first frame that looks settled, faces === server{" "}
            <code>d1</code>/<code>d2</code>. Covered by{" "}
            <code>dice-settle.test.ts</code> + visual lab{" "}
            <code>/dev/dice-lab</code>.
          </li>
          <li>
            Preserved: personal BANK, tap-to-roll, BEAN BUSTER on any 7, synced
            multiplayer, haptics/SFX, mint glow when you’re up.
          </li>
          <li>
            <strong>No PartyKit redeploy</strong> — client presentation only.
          </li>
        </ul>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Follow-ups</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Optional: remove unused 3D <code>dice-geometry</code> projection
            helpers once nothing else imports them.
          </li>
        </ul>
      </section>
    </main>
  );
}

import Link from "next/link";
import { RULES } from "@/shared/rules";

const COMMIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA;
const COMMIT_MESSAGE = process.env.VERCEL_GIT_COMMIT_MESSAGE;

export default function BuildNotesPage() {
  const shortSha = COMMIT_SHA ? COMMIT_SHA.slice(0, 7) : null;

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-8">
      <Link href="/" className="text-sm font-bold text-[var(--coral)]">
        ← Home
      </Link>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">
        Build notes
      </h1>
      <p className="text-sm text-[var(--muted)]">
        Public handoff — no secrets, credentials, or private session data.
      </p>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Deployed versions</h2>
        {COMMIT_SHA ? (
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Frontend (Vercel) SHA: <code className="break-all">{COMMIT_SHA}</code>{" "}
              ({shortSha})
            </li>
            {COMMIT_MESSAGE ? (
              <li>
                Message: <span className="italic">{COMMIT_MESSAGE}</span>
              </li>
            ) : null}
            <li>
              PartyKit backend host:{" "}
              <code>rushmore-bank.lwagnerjg.partykit.dev</code> (redeployed with
              this change set when party/ or shared engine changes land on main)
            </li>
          </ul>
        ) : (
          <p className="text-[var(--muted)]">
            Commit SHA appears on Vercel production via{" "}
            <code>VERCEL_GIT_COMMIT_SHA</code>.
          </p>
        )}
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Production URL</h2>
        <p>
          <a
            href={RULES.productionUrl}
            className="font-bold text-[var(--coral)] underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {RULES.productionUrl}
          </a>
        </p>
        <p>
          Site is public (no Vercel Authentication). Room privacy = join codes +
          per-tab guest tokens.
        </p>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">What changed</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Pull Out for waiting players</strong> — every active player
            can bank during cooldown / another roll; current roller blocked only
            after their own committed roll. Waiting banks do not clear alarms or
            advance the seat.
          </li>
          <li>
            <strong>Ballot privacy</strong> — explicit public-state projection;
            voter→choice maps stay server-side; clients see progress + own vote
            only; aggregates reveal with scores.
          </li>
          <li>
            <strong>Server-authoritative AI judging</strong> — PartyKit runs the
            judge job; client-submitted scores rejected; anonymous roster IDs;
            uniform neutral fallback;{" "}
            <code>/api/judge</code> protected for paid calls.
          </li>
          <li>
            <strong>Synced suspenseful dice</strong> — roll IDs, shared
            start/settle timestamps, time-based tumble, faces/pots hidden until
            settle; reconnect resumes or shows settled result.
          </li>
          <li>
            Topic <em>choices</em> vs <em>rounds played</em> clarified: 3 rounds
            (3–5 players) / 2 rounds (6–10); UI shows “Round X of Y”; auto final
            results.
          </li>
          <li>Dice UX: protected vs pot-at-risk, prominent Pull Out label.</li>
        </ul>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Tests run</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <code>npm test</code> — 39 vitest cases (banking out of turn,
            privacy snapshots, judge validation, 3/6/10 flow sims, all 36 face
            pairs, 469 banked-total example).
          </li>
          <li>
            <code>npx tsc --noEmit</code>, <code>npm run lint</code>,{" "}
            <code>npm run build</code> — pass.
          </li>
          <li>
            Browser automation (agent): post-deploy smoke of home + room join +
            dice UI where available — <strong>not</strong> a physical iPhone
            Safari play-test.
          </li>
        </ul>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Known limits</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Actual OpenAI judging requires <code>OPENAI_API_KEY</code> on the
            Vercel server (and preferably <code>JUDGE_SECRET</code> on both
            Vercel + PartyKit). If missing, rooms use labeled neutral awards —
            not presented as real AI.
          </li>
          <li>
            Soft 25–30 min session target is guidance; measured length depends on
            how fast the group drafts and banks.
          </li>
          <li>
            Standalone home-screen: favicon / apple-touch / manifest present;
            recovery is re-open URL or room code (guest token in sessionStorage).
          </li>
        </ul>
      </section>
    </main>
  );
}

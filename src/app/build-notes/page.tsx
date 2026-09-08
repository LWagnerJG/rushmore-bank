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
        Dice feel — perimeter glow, tap-to-roll, reveal punch, SFX/haptics →{" "}
        {RULES.productionUrl}
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
              <code>main</code>. PartyKit host stays{" "}
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
            Prior polish: cream iOS status bar, Gemini friendly notices, round-table
            dice, draft sticky timer + host Pause/+15s, topics settle, ideas
            tap-to-lock, no PartyKit errors to players.
          </li>
          <li>
            <strong>Your-turn glow</strong> — soft mint perimeter glow while it’s
            your dice turn; off after bank/bust/waiting.
          </li>
          <li>
            <strong>Tap dice to roll</strong> — dice tray is the primary hit target;
            big Roll button removed; Bank remains.
          </li>
          <li>
            <strong>Dramatic reveal</strong> — stronger settle punch, large total
            readout, brief hero beat with dimmed table.
          </li>
          <li>
            <strong>SFX + haptics</strong> — roll/settle/bank sounds (mute toggle);
            Vibration API for turn/tap/settle/bank/bust (no-op if unsupported).
          </li>
        </ul>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Production</h2>
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
        <p className="text-[var(--muted)]">
          DEFAULT_PARTYKIT_HOST ={" "}
          <code>rushmore-bank.lwagnerjg.partykit.dev</code>
        </p>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Follow-ups</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            This dice-feel commit is <strong>client-only</strong> — no new PartyKit
            code. If PartyKit was not redeployed after the prior judge-notice
            sanitize, still run <code>npm run deploy:party</code>.
          </li>
          <li>
            AI judging needs <code>GEMINI_API_KEY</code> + matching{" "}
            <code>JUDGE_SECRET</code>.
          </li>
        </ul>
      </section>
    </main>
  );
}

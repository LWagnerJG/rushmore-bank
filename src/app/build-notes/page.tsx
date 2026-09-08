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
        iPhone polish — status bar, Gemini 503, dice table →{" "}
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
            <strong>iOS status bar</strong> — cream <code>theme-color</code>,{" "}
            <code>viewport-fit=cover</code>,{" "}
            <code>apple-mobile-web-app-status-bar-style: black-translucent</code>,
            html/body cream into safe areas (no white clock stripe).
          </li>
          <li>
            <strong>Gemini 503</strong> — retry 429/503/5xx with short backoff;
            fallback flash models; player copy is only{" "}
            <em>Judge unavailable · neutral award.</em> (no HTTP codes). Quieter
            scores notice.
          </li>
          <li>
            <strong>Dice round table</strong> — always-visible seats (up / next /
            in / banked / bust); smoother settle animation; Roll is the primary
            action for the current roller.
          </li>
          <li>
            Preserved: type-your-own draft + always-on board, 4 topics + reroll,
            no PREP, Beans, Party Mode, Gemini judging, PartyKit host{" "}
            <code>rushmore-bank.lwagnerjg.partykit.dev</code>.
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
            <strong>Redeploy PartyKit required</strong> after merge —{" "}
            <code>party/server.ts</code> sanitizes judge notices (no raw HTTP).
            Run <code>npm run deploy:party</code>.
          </li>
          <li>
            AI judging still needs <code>GEMINI_API_KEY</code> (preferred) +
            matching <code>JUDGE_SECRET</code>.
          </li>
        </ul>
      </section>
    </main>
  );
}

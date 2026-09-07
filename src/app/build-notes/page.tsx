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
      <p className="rounded-xl bg-[rgba(167,215,194,0.45)] px-3 py-2 text-sm font-extrabold">
        Production polish — 4 topic choices + reroll, leaner lobby →{" "}
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
            <strong>Topics = 4 + reroll</strong> — always four vote options;
            host or any player can reroll the set as needed (no 1-reroll cap,
            no Auto/2/3 override).
          </li>
          <li>
            <strong>Cut fluff</strong> — removed “How we start”, home player-count
            line, and redundant lobby / Party Mode microcopy.
          </li>
          <li>
            Preserved: Beans branding, Party Mode switch, no PREP, fantasy draft,
            round-robin BANK, Gemini-first <code>gemini-3.5-flash</code>,
            production PartyKit host.
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
            <strong>Redeploy PartyKit</strong> after merge — topic shortlist is
            always 4 + unlimited reroll in <code>party/server.ts</code>.
          </li>
          <li>
            AI judging / draft suggestions need <code>GEMINI_API_KEY</code>{" "}
            (preferred) + matching <code>JUDGE_SECRET</code>.
          </li>
        </ul>
      </section>
    </main>
  );
}

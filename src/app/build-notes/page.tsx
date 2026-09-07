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
        Production ship — lobby + Party Mode switch + Fudge polish on{" "}
        <code>main</code> → {RULES.productionUrl}
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
            <strong>No prep phase</strong> — topic lock goes straight into
            draft (prep countdown removed).
          </li>
          <li>
            <strong>Lobby</strong> — clear status (gathering / ready), who’s
            in, share invite, how-we-start steps, large Start.
          </li>
          <li>
            <strong>Party Mode switch</strong> — slider-style toggle (off by
            default). When on: warmer accent, playful copy, optional sip
            prompts (Pass / nonalcoholic OK, no score penalty, no escalating
            drinking).
          </li>
          <li>
            <strong>Dice stability</strong> — WebGL scene mounts once; mute
            is a ref (no remount/flicker); time-based tumble; proper dispose;
            readable pips.
          </li>
          <li>
            <strong>Phone flow polish</strong> — home, vote, wager, bank,
            results: one obvious primary action, plain language, fluff cut.
          </li>
          <li>
            <strong>Per-player BANK</strong> — personal bank sequence after
            wagers; waiting players can Bank without advancing the current
            banker.
          </li>
          <li>
            <strong>Wager slider</strong> · fantasy snake draft board · dice
            polish · Beans naming · {RULES.minPlayers}–{RULES.maxPlayers}{" "}
            players.
          </li>
          <li>
            Preserved: Gemini-first <code>gemini-3.5-flash</code> judge,{" "}
            <code>JUDGE_SECRET</code>, ballot privacy, server-authoritative AI,
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
          <code>rushmore-bank.lwagnerjg.partykit.dev</code> (not fudge/test
          hosts).
        </p>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Follow-ups</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Soft bank budget is time-based (3 min); remaining pots auto-lock at
            a bank boundary.
          </li>
          <li>
            Party Mode / dice mute are client UI on existing protocols.
            Redeploy PartyKit after merge because <code>party/</code> drops the
            PREP phase (topic → draft).
          </li>
          <li>
            AI judging needs <code>GEMINI_API_KEY</code> (preferred) or OpenAI
            fallback + matching <code>JUDGE_SECRET</code>.
          </li>
        </ul>
      </section>
    </main>
  );
}

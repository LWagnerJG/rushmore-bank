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
        Production ship — Beans lobby / Party Mode / Codex draft + round-robin
        BANK → {RULES.productionUrl}
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
            <strong>Draft UX (from Codex)</strong> — Available / My queue /
            Board tabs, shared suggestions + search/add, sticky Lock pick,
            strong on-the-clock banner, fantasy snake board.
          </li>
          <li>
            <strong>Round-robin BANK (from Codex)</strong> — one roll then
            pass; everyone re-enters each topic (incl. W=0); two safe personal
            rolls; waiting Bank OK. Replaces Fudge solo mini-rounds.
          </li>
          <li>
            <strong>SVG pip dice (from Codex)</strong> — synced CSS/SVG cubes
            (no flaky WebGL); host sound opt-in toggle isolated from scene
            lifecycle.
          </li>
          <li>
            <strong>2-player scoring (from Codex)</strong> — AI-only, no forced
            votes.
          </li>
          <li>
            <strong>No PREP</strong> — topic → draft immediately.
          </li>
          <li>
            <strong>Lobby + Party Mode switch (this branch)</strong> — gathering
            / ready, who’s in, share invite, fun Party accent when on.
          </li>
          <li>
            <strong>Wager slider</strong> — full balance (E+B); Beans naming ·{" "}
            {RULES.minPlayers}–{RULES.maxPlayers} players.
          </li>
          <li>
            Preserved: Gemini-first <code>gemini-3.5-flash</code>,{" "}
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
          <code>rushmore-bank.lwagnerjg.partykit.dev</code>
        </p>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Follow-ups</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Redeploy PartyKit</strong> after merge — round-robin BANK +
            no PREP + draft-options fetch live in <code>party/</code>.
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

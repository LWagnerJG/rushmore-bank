import Link from "next/link";
import { RULES } from "@/shared/rules";
import { TOPIC_COUNT } from "@/shared/topics";

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
        Huge topic bank ({TOPIC_COUNT}) + anti-repeat shortlists →{" "}
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
              <code>main</code>. PartyKit host{" "}
              <code>rushmore-bank.lwagnerjg.partykit.dev</code> — redeploy
              required (topic shortlist anti-repeat lives in{" "}
              <code>party/</code>).
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
            <strong>Topic bank: {TOPIC_COUNT}</strong> unique Mount Rushmore–style
            prompts in <code>src/shared/topics.ts</code> (sports / food /
            everyday / entertainment). Researched + curated for phone party
            play — punchy, draftable, brand-safe.
          </li>
          <li>
            <strong>Anti-repeat</strong>: room tracks <code>seenTopicIds</code>{" "}
            across shortlists and rerolls (plus locked <code>usedTopicIds</code>
            ). Reroll pulls fresh options from the remaining pool; when soft
            history exhausts the bank, it reshuffles while still excluding
            locked topics. No topic timer.
          </li>
          <li>
            Topic pick UI unchanged in shape: 4 choices + Write your own +
            reroll. Scope labels capitalized; clearer subtitle.
          </li>
          <li>
            Preserved: dice scramble+settle, turn strip (no TABLE), failproof
            player rail, inline custom topic, Bank the Beans, personal BANK,
            admin, Beans branding.
          </li>
        </ul>
      </section>
    </main>
  );
}

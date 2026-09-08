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
        Vote / wager / BANK polish → {RULES.productionUrl}
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
            <strong>Vote UI</strong> — premium Rushmore cards (cream/mint/coral),
            clearer hierarchy, phone-first; restored panel chrome.
          </li>
          <li>
            <strong>Topic required</strong> — removed Void topic escape after
            voting/scoring. Tables cannot skip topic for the next round via
            void; topic selection stays in the loop.
          </li>
          <li>
            <strong>Why / rationale</strong> — AI “why” shows immediately under
            each list on vote (once judge returns) and score — no expand/collapse.
          </li>
          <li>
            <strong>Bank the Beans</strong> — score CTA renamed; every player
            taps; readiness shows <code>N/M ready</code>; advances to wager when
            all are ready (host can still force-advance).
          </li>
          <li>
            <strong>Wager</strong> — slider + risk/safe readout + one Lock-in.
            Keep/Half/All presets removed. Waiting shows ready count.
          </li>
          <li>
            <strong>Bean totals</strong> — player chips wrap; stronger score
            type; +earned visible on mid-game screens.
          </li>
          <li>
            <strong>BANK dice</strong> — clear zones (table / who’s up / tray /
            pot+Bank); settle hold so faces match authoritative result with no
            post-settle flip; BEAN BUSTER; full-phone mint glow when you’re up;
            personal BANK; tap-to-roll; Bank wording only; no sound toggle.
          </li>
          <li>
            Preserved: admin mode, {RULES.pickClockSeconds}s draft timer, sticky
            topic title, ideas UX, no topic timer, PartyKit host{" "}
            <code>rushmore-bank.lwagnerjg.partykit.dev</code>.
          </li>
        </ul>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Follow-ups</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Redeploy PartyKit required</strong> —{" "}
            <code>bank_the_beans</code> readiness, void-topic gate, dice settle
            hold live in <code>party/server.ts</code>. Run{" "}
            <code>npm run deploy:party</code>.
          </li>
        </ul>
      </section>
    </main>
  );
}

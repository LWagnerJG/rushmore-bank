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
        Full iPhone polish + home tighten + secret admin → {RULES.productionUrl}
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
            <strong>A · Status bar</strong> — cream theme-color, viewport-fit=cover,
            black-translucent, safe-area padding.
          </li>
          <li>
            <strong>B · Gemini</strong> — retry/backoff + flash fallbacks; friendly
            “Judge unavailable · neutral award.” only.
          </li>
          <li>
            <strong>C · Dice</strong> — round table; tap-to-roll; your-turn mint
            glow; dramatic reveal; SFX + haptics.
          </li>
          <li>
            <strong>D · Draft</strong> — sticky timer; host-only Pause/+15s; ideas
            tap-to-lock.
          </li>
          <li>
            <strong>E · Topics</strong> — no slide-up jump on land.
          </li>
          <li>
            <strong>F · Errors</strong> — “Connection lost — retrying”; never
            PartyKit/infra to players.
          </li>
          <li>
            <strong>G · Home</strong> — tighter create/join card, less chrome.
          </li>
          <li>
            <strong>H · Secret admin</strong> — logo ×5 → PIN unlock (session);
            discrete room panel to jump phases + spawn fake players. Not
            advertised on home.
          </li>
          <li>
            Preserved: Beans, 4 topics + reroll, no PREP, round-robin BANK,
            Gemini judging, PartyKit host{" "}
            <code>rushmore-bank.lwagnerjg.partykit.dev</code>.
          </li>
        </ul>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Follow-ups</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Redeploy PartyKit required</strong> — admin spawn/jump + judge
            notice sanitize live in <code>party/server.ts</code>. Run{" "}
            <code>npm run deploy:party</code>.
          </li>
        </ul>
      </section>
    </main>
  );
}

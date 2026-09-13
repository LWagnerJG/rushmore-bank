import Link from "next/link";
import { RULES } from "@/shared/rules";

const COMMIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA;
const COMMIT_MESSAGE = process.env.VERCEL_GIT_COMMIT_MESSAGE;

export default function BuildNotesPage() {
  const shortSha = COMMIT_SHA ? COMMIT_SHA.slice(0, 7) : null;

  return (
    <main className="app-shell app-shell-scroll mx-auto max-w-md space-y-6 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <Link href="/" className="text-sm font-bold text-[var(--coral)]">
        ← Home
      </Link>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">
        Build notes
      </h1>
      <p className="rounded-xl bg-[rgba(167,215,194,0.45)] px-3 py-2 text-sm font-extrabold">
        Wager piles · AT RISK vs stay safe → {RULES.productionUrl}
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
              Target: production <code>beans-game.vercel.app</code> via merge to{" "}
              <code>main</code>. Alias <code>roundacats.vercel.app</code> still
              works.
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
            <strong>Wager AT RISK / stay safe</strong>: two clear piles + split
            bar so the slider reads as real bean piles (coral risk / mint safe).
            Loud TIME badge + <em>Risk N beans</em> CTA kept. Clock remains{" "}
            <strong>45s</strong>.
          </li>
          <li>
            Prior: dice doubles show pot delta; home nickname-first; PartyKit
            redeploy still needed for the 45s timer if not yet live.
          </li>
        </ul>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">URL status</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Primary: <code>https://beans-game.vercel.app</code>
          </li>
          <li>
            Alias: <code>https://roundacats.vercel.app</code>
          </li>
          <li>
            After merge: Fudge can re-point the{" "}
            <code>roundacats.vercel.app</code> alias if Vercel doesn’t
            auto-attach the newest deployment to production.
          </li>
        </ul>
      </section>
    </main>
  );
}

import Link from "next/link";
import { RULES } from "@/shared/rules";
import { TOPIC_COUNT } from "@/shared/topics";

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
        Canonical production URL → {RULES.productionUrl}
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
              <code>main</code>. Old URL <code>roundacats.vercel.app</code>{" "}
              remains a working alias.
            </li>
            <li>
              <strong>PartyKit redeploy</strong> when{" "}
              <code>JUDGE_URL</code> / party server fallback changes — point at{" "}
              <code>beans-game.vercel.app</code> (no secrets in this page).
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
            <strong>Canonical URL flip</strong>:{" "}
            <code>RULES.productionUrl</code>, layout <code>siteUrl</code> /
            metadataBase / OG, docs, and PartyKit <code>JUDGE_URL</code> /
            judge fallback now use <code>https://beans-game.vercel.app</code>.
          </li>
          <li>
            <strong>Alias</strong>: <code>roundacats.vercel.app</code> still
            works (Vercel project renamed to <code>beans-game</code>; old host
            kept as alias).
          </li>
          <li>
            <strong>Share</strong>: lobby invite titles “Beans” and uses{" "}
            <code>window.location.origin</code> when in-browser (QR/share stay
            origin-based).
          </li>
          <li>
            No game logic changes. Preserved: topics ({TOPIC_COUNT}), Party Mode,
            vote/judge/BANK polish, rematch, bots. Repo name stays{" "}
            <code>rushmore-bank</code>.
          </li>
        </ul>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">URL status</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Primary: <code>https://beans-game.vercel.app</code> (Vercel project{" "}
            <code>beans-game</code>).
          </li>
          <li>
            Alias: <code>https://roundacats.vercel.app</code> still serves the
            same app.
          </li>
          <li>
            After merge: if the beans-game alias does not auto-attach to the
            newest deployment, Fudge can re-point it on Vercel.
          </li>
          <li>
            PartyKit: ensure deployed <code>JUDGE_URL</code> matches{" "}
            <code>beans-game.vercel.app</code> after this land (redeploy party
            if vars were baked previously).
          </li>
          <li>
            iOS tip: remove any old home-screen icon and re-Add to Home Screen
            if the PWA name/icon looks stale.
          </li>
        </ul>
      </section>
    </main>
  );
}

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
        Beans branding polish (PWA name + dog sunglasses icon) →{" "}
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
              <code>main</code>. Old URL stays live. Preferred alias{" "}
              <code>beans-game.vercel.app</code> needs Luke (below).
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
            <strong>PWA / home-screen name</strong>: manifest{" "}
            <code>name</code> / <code>short_name</code>,{" "}
            <code>apple-mobile-web-app-title</code>,{" "}
            <code>application-name</code>, document / OG / Twitter titles all{" "}
            <strong>Beans</strong> (not RoundaCats / rushmore-bank).
          </li>
          <li>
            <strong>App icon</strong>: new dog + <strong>BEANS sunglasses</strong>{" "}
            mark (cream / terracotta / ink). Wired: apple-touch 180, favicon,
            manifest 192/512 + maskable, OG share image. Source:{" "}
            <code>public/icons/icon-source-1024.png</code>.
          </li>
          <li>
            <strong>Share</strong>: lobby invite already titles “Beans” and uses
            current origin (no hardcoded RoundaCats in share text).
          </li>
          <li>
            Preserved from main: no review skim countdown, vote/AI judge board,
            earned split, BANK <code>+N beans</code> readout, Ready-to-wager
            header CTA, Safe/Risking labels, BANK cream stage, PlayerRail glow,
            Party Mode, topics ({TOPIC_COUNT}), rematch, bots. Repo name stays{" "}
            <code>rushmore-bank</code>.
          </li>
        </ul>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">URL — action for Luke</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Vercel project <code>roundacats</code> domains today:{" "}
            <code>roundacats.vercel.app</code>,{" "}
            <code>rushmore-bank.vercel.app</code>, plus team aliases. Production
            stays on <code>roundacats.vercel.app</code> so nothing breaks.
          </li>
          <li>
            <code>beans-game.vercel.app</code> is free (404 / not claimed). Agent
            CLI has no Vercel write token for domains — Luke should either:
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>
                Rename project to <code>beans-game</code> in Vercel → Settings →
                General (creates <code>beans-game.vercel.app</code>), then{" "}
                <strong>re-add</strong> <code>roundacats.vercel.app</code> as a
                domain alias so the old link keeps working; or
              </li>
              <li>
                Domains → Add <code>beans-game.vercel.app</code> if the UI
                offers a vercel.app alias without rename.
              </li>
            </ol>
          </li>
          <li>
            After the alias is live: flip <code>RULES.productionUrl</code>,{" "}
            <code>layout</code> <code>siteUrl</code>, and PartyKit{" "}
            <code>JUDGE_URL</code> to <code>beans-game.vercel.app</code>, then
            redeploy PartyKit.
          </li>
          <li>
            Custom DNS (optional, not done): <code>beans.game</code> ~$350/yr;{" "}
            <code>beansgame.com</code> ~$11/yr. <code>beans.vercel.app</code> is
            already someone else’s unrelated app — skip.
          </li>
          <li>
            iOS tip: remove any old home-screen icon and re-Add to Home Screen
            to pick up the new name + art (iOS caches aggressively).
          </li>
        </ul>
      </section>
    </main>
  );
}

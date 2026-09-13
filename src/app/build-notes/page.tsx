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
        Safari A2HS tip (⋯ → Share) → {RULES.productionUrl}
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
            <strong>Epic icon</strong>: refreshed dog + BEANS sunglasses mark
            (stronger silhouette, cream/terracotta). Source{" "}
            <code>public/icons/icon-source-1024.png</code> → favicon,
            apple-touch, manifest 192/512 + maskable, Next{" "}
            <code>icon.png</code> / <code>apple-icon.png</code>, OG.
          </li>
          <li>
            <strong>Add to Home Screen</strong>: one discreet bottom control.
            Chromium one-tap via <code>beforeinstallprompt</code> when
            available. iOS Safari tip: horizontal{" "}
            <strong>⋯ (bottom right) → Share → Add to Home Screen</strong>{" "}
            (not vertical ⋮; no tutorial wall). Hidden in standalone /
            fullscreen / minimal-ui / <code>navigator.standalone</code>.
          </li>
          <li>
            <strong>Cream bottom clip</strong>: lobby no longer reserves ~5.5rem
            of opaque shell padding for Admin FAB (that band ate topic-vibe
            chips). Shell keeps true <code>safe-area-inset-bottom</code> only;
            Start clears the FAB via <code>.lobby-start-slot</code>. Dropped
            scroll-phase <code>flex-1</code> + lingering rise transform that
            clipped panels.
          </li>
          <li>
            <strong>Ready to wager</strong>: CTA moved under the player rail
            (right), soft pulse — not buried in sticky header.
          </li>
          <li>
            <strong>TAP</strong>: cream/terracotta pill, quieter pulse when
            armed.
          </li>
          <li>
            <strong>Safe / pot</strong>: matching visual weight on the dice
            stage; Bank CTA shows discreet → total (safe + pot).
          </li>
          <li>
            Production URL remains <code>{RULES.productionUrl}</code>;{" "}
            <code>roundacats.vercel.app</code> alias. Topics ({TOPIC_COUNT}), no
            game logic change.
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
          <li>
            iOS: remove old home-screen icon and re-Add to pick up the new art.
          </li>
        </ul>
      </section>
    </main>
  );
}

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
      <p className="text-sm text-[var(--muted)]">
        Public handoff for Codex / reviewer testing — read-only, no secrets or
        credentials.
      </p>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Deployed commit</h2>
        {COMMIT_SHA ? (
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Full SHA: <code className="break-all">{COMMIT_SHA}</code>
            </li>
            <li>
              Short: <code>{shortSha}</code>
            </li>
            {COMMIT_MESSAGE ? (
              <li>
                Message: <span className="italic">{COMMIT_MESSAGE}</span>
              </li>
            ) : (
              <li className="text-[var(--muted)]">
                Commit message unavailable in this environment.
              </li>
            )}
          </ul>
        ) : (
          <p className="text-[var(--muted)]">
            Deployed commit SHA not available (local or non-Vercel build). On
            Vercel production this page shows{" "}
            <code>VERCEL_GIT_COMMIT_SHA</code> and{" "}
            <code>VERCEL_GIT_COMMIT_MESSAGE</code>.
          </p>
        )}
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Production URL — PUBLIC</h2>
        <p>
          Live site:{" "}
          <a
            href={RULES.productionUrl}
            className="font-bold text-[var(--coral)] underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {RULES.productionUrl}
          </a>
        </p>
        <p>
          <strong>The site is PUBLIC.</strong> There is no Vercel Authentication,
          no site password, and no IP allowlist. Anyone with the URL can open
          the home page.
        </p>
        <p>
          Room privacy is only random join codes plus per-tab guest session
          tokens — not deployment-level auth.
        </p>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">What changed in this progress build</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Full Quarry game: snake draft, Stones scoring, AI/fallback judging,
            personal dice, synchronized 3D dice, Party Mode.
          </li>
          <li>
            Per-tab guest IDs (<code>sessionStorage</code>) so two browser
            sessions can join the same room.
          </li>
          <li>
            Per-tab nicknames so Join uses the name from the URL/form, not a
            shared Luke name across tabs.
          </li>
          <li>Dog favicon / home-screen / OG icons.</li>
        </ul>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Known limits (honest)</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <code>OPENAI_API_KEY</code> may be unset → fallback judge labeled
            “Judge unavailable…”.
          </li>
          <li>
            PartyKit <strong>was redeployed</strong> to{" "}
            <code>rushmore-bank.lwagnerjg.partykit.dev</code> — the old “blocked /
            old protocol” claim no longer applies.
          </li>
          <li>
            Full 3–10 player physical-device timing has not been fully measured
            yet.
          </li>
          <li>
            Need {RULES.minPlayers} players to Start (<code>minPlayers</code>).
          </li>
        </ul>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Reviewer / Codex test steps</h2>
        <p className="text-[var(--muted)]">
          Use a clean browser with no Vercel account required.
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Open{" "}
            <a
              href={RULES.productionUrl}
              className="font-bold text-[var(--coral)] underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {RULES.productionUrl}
            </a>{" "}
            → expect HTTP 200 and the Quarry home screen.
          </li>
          <li>Create Game as Alice.</li>
          <li>
            Second session (new tab or private window): Join as Bob with the
            room code.
          </li>
          <li>Confirm Players (2/10) shows Alice and Bob.</li>
          <li>
            Optional: add Carol, Start, spin a topic, complete one draft pick.
          </li>
        </ol>
      </section>

      <section className="panel space-y-3 text-sm">
        <h2 className="font-extrabold">Visual refs</h2>
        <p>
          Rules walkthrough:{" "}
          <Link
            href="/how-to-play"
            className="font-bold text-[var(--coral)] underline"
          >
            /how-to-play
          </Link>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <figure className="space-y-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/apple-touch-icon.png"
              alt="Apple touch icon (dog mascot)"
              className="h-24 w-24 rounded-xl border border-black/10 bg-white object-contain"
            />
            <figcaption className="text-xs text-[var(--muted)]">
              /apple-touch-icon.png
            </figcaption>
          </figure>
          <figure className="space-y-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/og-image.png"
              alt="Open Graph image"
              className="h-24 w-full rounded-xl border border-black/10 bg-white object-cover"
            />
            <figcaption className="text-xs text-[var(--muted)]">
              /og-image.png
            </figcaption>
          </figure>
        </div>
      </section>
    </main>
  );
}

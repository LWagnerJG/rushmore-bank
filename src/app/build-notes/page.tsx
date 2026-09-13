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
        Polish ship — dice declutter, spectator, vibes, settings, rematch → {RULES.productionUrl}
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
              <code>main</code>. PartyKit redeploy required when{" "}
              <code>src/shared</code> changes (topics are bundled into the party
              server) — also for reconnect/leave/rejoin and review+vote timers.
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
            <strong>Dice declutter</strong>: quieter safe/pot chrome on the turn
            strip (S/P numbers), clearer Your pot vs Your safe hierarchy, faint{" "}
            <code>TAP</code> on the dice as the primary CTA; Bank stays secondary.
          </li>
          <li>
            <strong>BEAN BUSTER linger</strong>: ~2s hold + fade before the next
            seat (<code>diceBustHoldMs</code>) so the bust moment feels intentional.
          </li>
          <li>
            <strong>Spectator mode</strong>: when banked/out, calm Spectator status
            (“Watching X roll”) — no dead Bank CTAs.
          </li>
          <li>
            <strong>How to play removed</strong>: dropped from home;{" "}
            <code>/how-to-play</code> redirects home.
          </li>
          <li>
            <strong>Beans logo = settings</strong>: tap the bean for Sound FX
            on/off (localStorage) + copyable room code for everyone. Always-on CODE
            chip demoted.
          </li>
          <li>
            <strong>Sound FX + haptics</strong>: roll / settle / bank / bust SFX
            respect mute; Vibration API haptics stay best-effort.
          </li>
          <li>
            <strong>Rematch</strong>: after final results, Rematch keeps room +
            players and starts a fresh run (no re-entering codes).
          </li>
          <li>
            <strong>Topic vibes</strong>: Basic / Spicy / Niche filter in lobby
            (and host topic screen) wired into shortlist + reroll.
          </li>
          <li>
            <strong>PWA polish</strong>: richer manifest (maskable icon, categories);
            friendlier <code>Reconnecting…</code> copy (never says PartyKit).
          </li>
          <li>
            Preserved: scramble settle honesty, min wager 1, leave/rejoin, 60s draft,
            vote auto-start, fillable topics, Beans branding, admin, bots.
          </li>
</ul>
      </section>
    </main>
  );
}

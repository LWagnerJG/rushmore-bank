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
        PlayerRail You-chip: full ring + soft glow → {RULES.productionUrl}
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
            <strong>Topic vibes</strong>: All / Basic / Sports / Animals /
            Geography (Spicy &amp; Niche removed) — filters shortlist + reroll.
          </li>
          <li>
            <strong>Party Mode (real)</strong>: ON expands drink rules. Bust →
            once-per-round drink redo CTA (<code>Finished drink · redo bust</code>
            ) or Pass. Round end → lowest beans drink +{" "}
            <code>I finished my drink</code> (ties share; bots auto-resolve;
            next topic gated).
          </li>
          <li>
            <strong>Draft polish</strong>: removed redundant “Type your answer”
            under Your turn; stash + draft board get stronger panel contrast on
            cream. Up-seat You-chip gold ring + glow no longer clipped on the
            rail (fit mode uses real <code>overflow: visible</code>; scroll mode
            pads the track — extra inline inset so the leading You ring isn’t
            shaved on the left; sticky chrome blur on a <code>::before</code>).
            Glow is a longer multi-layer falloff so it eases into cream instead
            of a hard cutoff.
          </li>
          <li>
            <strong>Dice TAP</strong>: TAP sits on top of the dice and blinks
            when armed to roll.
          </li>
          <li>
            <strong>Bank confirm</strong>: “Are you sure you want to Bank?”
            modal; idle bank timer pauses while open.
          </li>
          <li>
            Preserved: spectator, logo settings, rematch, scramble settle, min
            wager 1, leave/rejoin, 60s draft, vote auto-start, Beans branding,
            admin, bots.
          </li>
        </ul>
      </section>
    </main>
  );
}

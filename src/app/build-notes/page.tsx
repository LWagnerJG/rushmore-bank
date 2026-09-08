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
        UX / playability polish → {RULES.productionUrl}
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
              <code>main</code>. PartyKit unchanged this ship (no{" "}
              <code>party/</code> edits).
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
            <strong>Background / safe-area</strong>: fixed full-bleed cream
            gradient on <code>body::before</code>,{" "}
            <code>overscroll-behavior</code>, <code>100dvh</code> +{" "}
            <code>-webkit-fill-available</code>. Home locks height (no phantom
            rubber-band); room scrolls only when content overflows. Fixes the
            iPhone bottom white banner.
          </li>
          <li>
            <strong>Player rail = leaderboard</strong>: local player always
            top-left (“You”), then beans descending (seat tiebreak). Fit mode
            shares width for ≤5 (and 6–7 on wider phones); 8–10 stay denser
            single-row scroll — never clips.
          </li>
          <li>
            <strong>Ideas → Stash</strong>: clearer on-brand name for the
            waiting queue. Stash while waiting / Lock in (tap-to-use) when
            you’re up. Local storage key unchanged.
          </li>
          <li>
            <strong>Draft board density</strong>: cozy / snug / dense by player
            count (narrower columns, smaller type, sticky headers) so 6–10 stay
            usable on phone.
          </li>
          <li>
            Preserved: topic bank ~{TOPIC_COUNT} + anti-repeat, dice
            scramble+settle, turn strip (no TABLE), Bank the Beans, personal
            BANK, admin, Beans branding, 60s draft / 15s dice, inline Write
            your own.
          </li>
        </ul>
      </section>
    </main>
  );
}

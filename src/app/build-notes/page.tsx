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
        BEAN BUSTER + any-7 + draft sticky topic → {RULES.productionUrl}
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
            <strong>BEAN BUSTER</strong> — any roll totaling 7 busts (including
            first roll of a turn). No safe-first / +70 freebie. Roller +
            spectators get a clear shared moment; pot wiped; turn ends; next
            seat. Party sip uses the same wording.
          </li>
          <li>
            <strong>Draft sticky topic</strong> — selected topic title lives in
            the sticky top banner (stays visible while scrolling). Timer + host
            Pause/+15s stay discrete top-right. Body focuses on turn → board →
            ideas.
          </li>
          <li>
            <strong>BANK rule</strong> — personal continuous turn: keep rolling
            until Bank or bust, then next seat. Waiting players watch (no early
            Bank / sit-out).
          </li>
          <li>
            <strong>Wager</strong> — one earned line, one risk number, slider +
            Keep/Half/All, single Lock-in CTA.
          </li>
          <li>
            <strong>Dice UI</strong> — light turn strip; dice tray hero;
            full-phone mint perimeter glow when you’re up; snap settle to
            authoritative faces (no post-settle flip); dramatic punch; SFX
            without mute toggle; Bank wording only.
          </li>
          <li>
            <strong>Draft ideas</strong> — embedded ideas surface (no drawer);
            one CTA: Save idea while waiting / Lock in when up; tap queued idea
            to lock instantly on your turn.
          </li>
          <li>
            <strong>Topics</strong> — no topic-selection countdown; pick calmly
            until all vote. Draft pick clock unchanged.
          </li>
          <li>
            Preserved: Beans branding, admin mode, dice feel, PartyKit host{" "}
            <code>rushmore-bank.lwagnerjg.partykit.dev</code>.
          </li>
        </ul>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Follow-ups</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Redeploy PartyKit required</strong> — any-7 bust lives in
            shared engine used by <code>party/server.ts</code>. Run{" "}
            <code>npm run deploy:party</code>.
          </li>
        </ul>
      </section>
    </main>
  );
}

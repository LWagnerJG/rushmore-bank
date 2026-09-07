import Link from "next/link";
import { RULES } from "@/shared/rules";
import { TOPIC_COUNT } from "@/shared/topics";

export default function BuildNotesPage() {
  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-8">
      <Link href="/" className="text-sm font-bold text-[var(--coral)]">
        ← Home
      </Link>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">
        Build notes
      </h1>
      <p className="text-sm text-[var(--muted)]">
        Public handoff — no secrets. Production: {RULES.productionUrl}
      </p>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Shipped</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Full Quarry state machine on PartyKit (durable storage + alarms).
          </li>
          <li>
            Snake draft, private My Ideas, host corrections, human+AI scoring.
          </li>
          <li>Personal pots, Pull Out, synchronized three.js 3D dice.</li>
          <li>
            Theme palette bg {RULES.colors.bg}, text {RULES.colors.text}, coral{" "}
            {RULES.colors.coral}.
          </li>
          <li>Dog mascot kept for favicon / apple-touch / OG / PWA icons.</li>
          <li>Topic bank: {TOPIC_COUNT} curated prompts.</li>
        </ul>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Defaults (typed)</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Start balance {RULES.startBalance}; players {RULES.minPlayers}–{RULES.maxPlayers}</li>
          <li>
            Pick clock {RULES.pickClockSeconds}s + grace {RULES.pickGraceSeconds}s
          </li>
          <li>
            Score: {RULES.scoreBase} + AI(0–{RULES.aiAwardMax}) +{" "}
            {RULES.stonesPerHumanVote}×votes
          </li>
          <li>
            Earlier wager cap {RULES.earlierWagerCap}; dice countdown{" "}
            {RULES.diceDecisionCountdownSeconds}s; idle bank{" "}
            {RULES.diceIdleBankSeconds}s
          </li>
          <li>Party Mode default: {String(RULES.partyModeDefault)}</li>
          <li>AI prompt version: {RULES.aiPromptVersion}</li>
        </ul>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">AI credential status</h2>
        <p>
          Judging uses <code>OPENAI_API_KEY</code> on the Next.js deployment when
          present. If missing, the server applies the neutral fallback award and
          labels explanations “Judge unavailable…”. No keys are embedded in the
          client.
        </p>
        <p>
          <strong>This build environment:</strong> OpenAI key was not available —
          fallback path verified in smoke.
        </p>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Blocked connection</h2>
        <p>
          PartyKit cloud deploy requires <code>PARTYKIT_LOGIN</code> +{" "}
          <code>PARTYKIT_TOKEN</code> (generate via{" "}
          <code>npx partykit token generate</code>). Until redeployed, production
          sockets still speak the old Rushmore Bank protocol. GitHub Action{" "}
          <code>Deploy PartyKit</code> runs on main after secrets are set; or run{" "}
          <code>npm run deploy:party</code> once locally after merge.
        </p>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Architecture choice</h2>
        <p>
          Extended PartyKit (not replaced): room storage is authoritative;
          <code>storage.setAlarm</code> drives phase/pick/wager/dice deadlines so
          timers continue if the host phone sleeps. Smallest sound change vs
          moving authority elsewhere.
        </p>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Testing record</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <code>npm test</code> — snake 3–10, scoring, wager math, dice path
            105→175→187→374, bust.
          </li>
          <li>Local multi-context smoke documented in PR / TESTING.md.</li>
        </ul>
      </section>
    </main>
  );
}

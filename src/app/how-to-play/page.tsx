import Link from "next/link";

export default function HowToPlayPage() {
  return (
    <main className="mx-auto max-w-md space-y-6 px-4 pb-8 pt-[max(2rem,env(safe-area-inset-top))]">
      <Link href="/" className="text-sm font-bold text-[var(--coral)]">
        ← Home
      </Link>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">
        How to Play
      </h1>
      <section className="panel space-y-2">
        <h2 className="font-extrabold">Setup</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>One friend Creates; others Join with the code, link, or QR.</li>
          <li>Host Starts when the crew is in.</li>
          <li>
            Optional Party Mode: sip prompts after busts or wins. Pass anytime —
            no score effect.
          </li>
        </ol>
      </section>

      <section className="panel space-y-2">
        <h2 className="font-extrabold">Each topic</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Vote one of four topics (reroll anytime — no timer).</li>
          <li>
            Snake draft four answers (60s pick clock) — type your own, board
            always on. Save ideas while waiting; Lock in on your turn (tap a
            saved idea to lock).
          </li>
          <li>
            Vote another’s roster (2 players: AI only). Earn beans.
          </li>
          <li>
            Risk beans on the slider (zero still plays). Then personal bank —
            keep rolling until you Bank or bust; **any 7** (including first
            roll) is BEAN BUSTER. Next player after that.
          </li>
        </ol>
      </section>

      <section id="homescreen" className="panel space-y-2">
        <h2 className="font-extrabold">Add to Home Screen</h2>
        <p className="text-sm">
          Safari: Share → Add to Home Screen. Chrome: Menu → Install app.
        </p>
      </section>
    </main>
  );
}

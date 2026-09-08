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
          <li>Vote one of four topics (reroll anytime).</li>
          <li>
            Snake draft four answers — type your own, board always on. Lock pick
            on your turn. Optional private My Ideas while waiting.
          </li>
          <li>
            Vote another’s roster (2 players: AI only). Earn beans.
          </li>
          <li>
            Slider: risk beans (zero still plays). Then round-robin bank —
            one roll, pass, two safe rolls. Bank anytime.
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

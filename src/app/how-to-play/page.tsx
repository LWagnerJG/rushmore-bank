import Link from "next/link";

export default function HowToPlayPage() {
  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-8">
      <Link href="/" className="text-sm font-bold text-[var(--coral)]">
        ← Home
      </Link>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">
        How to Play
      </h1>
      <p className="text-[var(--muted)]">Draft four. Roll for more.</p>

      <section className="panel space-y-2">
        <h2 className="font-extrabold">Setup</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>One friend Creates; others Join with the code, link, or QR.</li>
          <li>Nickname only. Host Starts at 3–10 players.</li>
        </ol>
      </section>

      <section className="panel space-y-2">
        <h2 className="font-extrabold">Each topic</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Vote a spun topic (or host custom).</li>
          <li>Snake draft four answers — Lock In on your turn.</li>
          <li>Vote another’s roster; AI judges too. Earn Stones.</li>
          <li>Wager into your pot. Roll personal dice or Pull Out.</li>
        </ol>
      </section>

      <section id="homescreen" className="panel space-y-2">
        <h2 className="font-extrabold">Home Screen / PWA</h2>
        <p className="text-sm font-semibold">Safari (iPhone)</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Open the site in Safari.</li>
          <li>Share → Add to Home Screen → Add.</li>
        </ol>
        <p className="text-sm font-semibold">Android Chrome</p>
        <p className="text-sm">Menu → Add to Home screen / Install app.</p>
      </section>

      <p className="text-sm text-[var(--muted)]">
        Full rules in the repo at <code>docs/RULES.md</code>.
      </p>
    </main>
  );
}

import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export default function BuildNotesPage() {
  return <main className="mx-auto max-w-lg space-y-5 px-5 py-8">
    <Link href="/" className="text-sm font-bold underline">Back to Beans</Link>
    <BrandMark />
    <h1 className="text-2xl font-extrabold">Build notes</h1>
    <section className="panel space-y-2 text-sm">
      <p>Frontend commit: <code className="break-all">{process.env.VERCEL_GIT_COMMIT_SHA || "Local build"}</code></p>
      <p>Environment: {process.env.NEXT_PUBLIC_APP_ENV || process.env.VERCEL_ENV || "development"}</p>
      <p>Expected game server release: beans-roundrobin-v1. Frontend deployment alone does not verify the separate PartyKit release.</p>
    </section>
    <ul className="list-disc space-y-3 pl-5 text-sm">
      <li>2–10 players. Live lobby roster, room code, invite link and QR.</li>
      <li>Available picks, a private queue, and a four-row snake draft board. Any valid custom answer can be entered.</li>
      <li>Wager slider from zero through the full current bean balance.</li>
      <li>One roll, then pass. Everyone returns each topic, including zero wagers, with two safe rolls. Bank or bust to leave the dice round.</li>
      <li>Shared animated pip dice, with reduced motion and optional host sound.</li>
      <li>Fudge’s Gemini judge and model configuration are preserved. AI suggestion failures never block drafting.</li>
    </ul>
    <p className="text-sm">Release checks cover server flows, scoring, privacy, banking, timers and browser play against local servers. Real AI calls and physical iPhones require a separate deployed check.</p>
  </main>;
}

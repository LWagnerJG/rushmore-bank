import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export default function BuildNotesPage() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  const environment = process.env.NEXT_PUBLIC_APP_ENV || "development";
  return <main className="mx-auto max-w-lg space-y-5 px-5 py-8">
    <Link href="/" className="text-sm font-bold underline">Back to Beans</Link>
    <BrandMark />
    <h1 className="text-2xl font-extrabold">Build notes</h1>
    <section className="panel space-y-2 text-sm">
      <p>Environment: {environment}</p>
      <p>Frontend commit: <code className="break-all">{sha || "Local build"}</code></p>
      <p>Backend revision: not independently verified by this page.</p>
    </section>
    <section className="panel space-y-2 text-sm">
      <h2 className="text-lg font-extrabold">Beans changes</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>Beans name, currency, bean character, favicon, home-screen icons, and share image.</li>
        <li>Simpler entry, wager choices, bank labels, score explanations, and player instructions.</li>
        <li>Waiting players banking no longer invalidate the pending dice alarm.</li>
        <li>Paid judge requests require the shared server secret; a caller-supplied header is insufficient.</li>
        <li>Test previews refuse to silently connect to the production PartyKit host.</li>
      </ul>
    </section>
    <section className="panel space-y-2 text-sm">
      <h2 className="text-lg font-extrabold">Verification scope</h2>
      <p>Dependency-free local regression checks cover all 108 dice cases, actual server banking/timer handlers with 3, 6, and 10 players, duplicate banking, ballot projection, rejection of client scores, judge authorization, and test-server isolation.</p>
      <p>Local full Next.js build, browser play-test, and real iPhone test are not claimed. Check this commit&apos;s CI status for build and lint results.</p>
      <p>A working frontend build does not establish that the separate multiplayer backend or real AI judging was deployed successfully.</p>
    </section>
  </main>;
}

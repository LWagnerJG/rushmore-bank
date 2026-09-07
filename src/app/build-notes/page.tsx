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
        <li>Two-player games use AI judging without a forced ballot; 3–10 players keep room votes.</li>
        <li>Private ideas available during prep and draft; earlier-pick corrections resume the interrupted turn.</li>
        <li>Waiting players banking no longer invalidate the pending dice alarm.</li>
        <li>Fudge&apos;s Gemini integration and PR #11 model update are included. GEMINI_MODEL is configurable; the supported default is gemini-3.5-flash.</li>
        <li>Paid judge requests require the shared server secret; a caller-supplied header is insufficient.</li>
        <li>Test previews refuse to silently connect to the production PartyKit host.</li>
      </ul>
    </section>
    <section className="panel space-y-2 text-sm">
      <h2 className="text-lg font-extrabold">Gemini and deployment handoff</h2>
      <p>Main PR #9&apos;s notes report a successful manual production PartyKit deploy. The separate CI deployment failed due to missing credentials. This preview does not independently verify that backend revision.</p>
      <p>Gemini remains preferred via GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY. OpenAI is used when no Gemini key is set. Provider failure uses a labeled neutral award. Paid judging needs the same JUDGE_SECRET on both servers.</p>
      <p>Google lists Gemini 2.0 Flash as shut down on June 1, 2026. Fudge&apos;s PR #11 updates the default to Gemini 3.5 Flash; this branch preserves it and allows an environment override. Real-key scoring still needs a deployed test.</p>
    </section>
    <section className="panel space-y-2 text-sm">
      <h2 className="text-lg font-extrabold">Verification scope</h2>
      <p>Dependency-free local regression checks cover all 108 dice cases, actual server banking/timer handlers with 2, 3, 6, and 10 players, duplicate banking, ballot projection, rejection of client scores, judge authorization, and test-server isolation.</p>
      <p>Complete three-round two-player server flows pass with mocked Gemini, Google-key-alias, OpenAI and neutral responses. Correction and replacement-timeout regressions pass at 2, 3 and 10 players.</p>
      <p>Local full Next.js build, browser play-test, and real iPhone test are not claimed. Check this commit&apos;s CI status for build and lint results.</p>
      <p>A working frontend build does not establish that the separate multiplayer backend or real AI judging was deployed successfully.</p>
    </section>
  </main>;
}

# Beans: test release setup

Branch: `cursor/beans-test-preview-3333` (supersedes `codex/beans-preview` / PR #10).
Production remains `main` at https://roundacats.vercel.app — **do not merge or promote this branch yet.**

## What this branch changes

Beans branding and icons, clearer entry and wager screens, simpler score details,
banking copy, **2–10 players**, waiting-bank alarm regression fix, and required
`JUDGE_SECRET` for paid judging. Gemini-first judging (`gemini-3.5-flash`) from
current `main` is preserved, with OpenAI fallback.

Legacy `stones` state fields, storage keys, room IDs, and the production PartyKit
name remain compatible for protocol/storage — UI copy says **beans**.

## What must be configured before multiplayer testing

Use the Vercel account that owns `roundacats`. Do not disable production protection
and do not point this build at production PartyKit.

Create a separate Vercel project named `roundacats-test` using this repository,
tracking `cursor/beans-test-preview-3333`. The requested hostname
`roundacats-test.vercel.app` must first be verified as available and assigned.

A normal PR preview URL is also suitable, but both approaches need a separate backend.

| Location | Setting | Required value |
| --- | --- | --- |
| Test Vercel project | `NEXT_PUBLIC_APP_ENV` | `test` |
| Test Vercel project | `NEXT_PUBLIC_PARTYKIT_HOST` | Actual deployed **test** PartyKit hostname, without protocol |
| Test Vercel server | `JUDGE_SECRET` | Test-only secret, identical to the test backend's |
| Test Vercel server | `GEMINI_API_KEY` (preferred) or `OPENAI_API_KEY` | Server-side key if real AI is desired |
| Test PartyKit | project name | Separate from `rushmore-bank` (see `partykit.test.json`) |
| Test PartyKit | `JUDGE_URL` | Actual test frontend origin |
| Test PartyKit | `JUDGE_SECRET` | Same test-only secret |

`partykit.test.json` is a prepared test configuration, not evidence of deployment.
Use the PartyKit CLI with that config file after checking its help.
If using an automatically generated preview hostname, update `JUDGE_URL` accordingly.
Never deploy the default production PartyKit config from this branch for testing.

Without a test backend, preview rooms show an honest setup state and will not silently use
the production server. Production builds retain the existing default backend.

A separate test frontend can still mutate production rooms if it points to the live backend.
That is why the preview host guard and separate PartyKit instance are required.

## Checks

- `node --experimental-vm-modules scripts/verify-beans.mjs`
- `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`
- Run 2/6/10-player browser flows and a real iPhone Safari session
- Confirm both deployed revisions and a completed real AI judgment with Gemini
- Verify a test room cannot be joined through the live backend and vice versa

## Promotion

After Luke and Brynna approve a tested release: bring this branch up to date,
rerun checks, merge the reviewed PR, and build for production with production
settings. Deploy the matching production backend deliberately.
Do not blindly promote the test artifact: its baked-in backend/environment points at test.
Keep the prior frontend and backend revisions available for rollback.

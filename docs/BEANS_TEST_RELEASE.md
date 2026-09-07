# Beans: test release setup

Branch: `codex/beans-preview`. Production remains `main`.

## What this branch changes

Beans branding and icons, clearer entry and wager screens, simpler score details,
banking copy, waiting-bank alarm regression fix, and required authentication for paid judging.
Legacy `stones` state fields, storage keys, room IDs, and the production PartyKit name remain compatible.

## What must be configured before multiplayer testing

Use the Vercel account that owns `roundacats`. Codex's connected account returned
no teams and 403 for this project on 2026-09-07. Do not disable production protection.

Create a separate Vercel project named `roundacats-test` using this repository,
tracking `codex/beans-preview`. The requested hostname
`roundacats-test.vercel.app` must first be verified as available and assigned.

A normal PR preview URL is also suitable, but both approaches need a separate backend.

| Location | Setting | Required value |
| --- | --- | --- |
| Test Vercel project | `NEXT_PUBLIC_APP_ENV` | `test` |
| Test Vercel project | `NEXT_PUBLIC_PARTYKIT_HOST` | Actual deployed test PartyKit hostname, without protocol |
| Test Vercel server | `JUDGE_SECRET` | Test-only secret, identical to the test backend's |
| Test Vercel server | `OPENAI_API_KEY` | Server-side key if real AI is desired |
| Test PartyKit | project name | Separate from `rushmore-bank` |
| Test PartyKit | `JUDGE_URL` | Actual test frontend origin |
| Test PartyKit | `JUDGE_SECRET` | Same test-only secret |

`partykit.test.json` is a prepared test configuration, not evidence of deployment.
Use the installed PartyKit CLI's configuration-file option after checking its help.
If using an automatically generated preview hostname, update JUDGE_URL accordingly.
Never deploy the default production config from this branch for testing.

Without a test backend, preview rooms show an honest setup state and will not silently use
the production server. Production builds retain the existing default backend.

A separate test frontend can still mutate production rooms if it points to the live backend.
That is why the preview host guard and separate PartyKit instance are required.

## Checks

- `node --experimental-vm-modules scripts/verify-beans.mjs` on Node 24.
- `npm test`, `npm run lint`, `npm run build`.
- Run 3/6/10-player browser flows and a real iPhone Safari session.
- Confirm both deployed revisions and a completed real AI judgment.
- Verify a test room cannot be joined through the live backend and vice versa.

Local regression tests passed. Local dependencies could not be installed because
the environment returned 403 for an npm tarball. Babel syntax/transpilation checks
passed using the installed browser tooling. These are not a full Next.js build.

The existing PartyKit GitHub Actions deployment for commit `053bf76` failed;
check whether Fudge deployed manually before assuming which backend is running.

## Promotion

After Luke and Brynna approve a tested release: bring this branch up to date,
rerun checks, merge the reviewed PR, and build for production with production
settings. Deploy the matching production backend deliberately.
Do not blindly promote the test artifact: its baked-in backend/environment points at test.
Keep the prior frontend and backend revisions available for rollback.

# Beans: isolated test release

Fudge’s test release: `cursor/beans-test-preview-3333`, PR https://github.com/LWagnerJG/rushmore-bank/pull/12.
Codex follow-up: `codex/beans-preview`, targeting that test branch. PR #10 was closed by the coordinator; it is not the release path.
Production remains `main` at https://roundacats.vercel.app.

## Current preview and access

The GitHub Vercel integration created this branch preview:
https://roundacats-git-codex-bean-606892-luke-wagners-projects-f997cc34.vercel.app.
Check the Vercel bot and commit status for the latest build before testing. Until the settings below are present, room pages show a setup message instead of connecting to production.

The requested `roundacats-test.vercel.app` has not been provisioned. An owning-account operator can create a separate Vercel project named `roundacats-test`, point it at the reviewed combined test branch, and verify the assigned hostname. The existing branch preview is also suitable once connected to an isolated backend.

Codex's connected Vercel account returned no teams and 403 for project `prj_xzzfvPRqpyh90IrQENKBnL7amWGR` on 2026-09-07. GitHub access worked. These access results do not establish a public-site firewall bug and are not a reason to weaken production protection.

## Changes prepared

- Beans branding, currency labels, bean character, favicon, home-screen icons, and share image.
- Two through ten players. Two-player games skip human ballots and use AI-only scoring; three or more retain private voting plus AI.
- Shorter home, draft, topic, and score screens. Private ideas work in prep and draft. Wagers require an explicit lock after choosing an amount.
- Waiting players banking preserve the current dice alarm and seat.
- Earlier-pick corrections resume the interrupted cursor, including replacement timeouts. Locked-score corrections cannot remove picks. Stale judge jobs are invalidated.
- Fudge's Gemini integration and provider tests are incorporated from main PR #9, PR #11's model update, and test PR #12, rather than replaced with the older OpenAI route.
- `GEMINI_MODEL` is configurable, default `gemini-3.5-flash`. Google lists the old hardcoded model's June 1, 2026 shutdown in its [model schedule](https://ai.google.dev/gemini-api/docs/deprecations).
- Paid judge calls require matching `JUDGE_SECRET`; a caller-supplied PartyKit header alone is not authentication. Both provider calls have deadlines.

Legacy `stones` state fields, browser-storage keys, room identifiers, and the production PartyKit project name are retained for compatibility.

## Required setup

Use the Vercel and PartyKit accounts that own the project. Do not use the default production PartyKit config to deploy this test branch.

| Location | Setting | Value |
| --- | --- | --- |
| Existing Vercel project, Preview env scoped to the selected test branch | `NEXT_PUBLIC_PARTYKIT_HOST` | Actual isolated test PartyKit hostname, no protocol |
| Separate Vercel test project, if used instead | `NEXT_PUBLIC_APP_ENV` | `test` |
| Separate Vercel test project | `NEXT_PUBLIC_PARTYKIT_HOST` | Same isolated test hostname |
| Test frontend server only | `JUDGE_SECRET` | A new test-only shared secret |
| Test frontend server only | `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` | Valid Gemini key; never `NEXT_PUBLIC_` |
| Test frontend server only | `GEMINI_MODEL` | Supported model ID; default `gemini-3.5-flash` |
| Test frontend server only | `OPENAI_API_KEY` | Optional; used only if no Gemini key is set |
| Test PartyKit | project name | Separate project such as `roundacats-test` |
| Test PartyKit | `JUDGE_URL` | Exact test frontend origin, including `https://` |
| Test PartyKit | `JUDGE_SECRET` | Identical to the test frontend's shared secret |

`partykit.test.json` is a prepared config, not a deployment receipt. Confirm the installed CLI's configuration-file option in its help; deploy that config explicitly. Update `JUDGE_URL` to the actual preview origin if the short hostname has not been assigned. Provider API keys belong on the frontend server; PartyKit only needs the shared judge secret.

Deploy the test backend from the same commit as the frontend. Record both revisions. Set the frontend variables, then rebuild: public backend settings are compiled into the browser bundle. Confirm the test backend can call the test judge route with its secret. If the preview requires authentication, configure supported service-to-service test access; do not expose credentials in browser URLs.

The preview guard rejects a missing backend or the known production hostname. A different hostname must still be checked to ensure it really serves the isolated project. A frontend URL alone does not isolate room state.

## Verification and release gate

Run on Node 24:

```bash
npm ci
npm test
npm run lint
node --experimental-vm-modules scripts/verify-beans.mjs
npm run build
```

The regression script exercises actual server handlers with mocked storage and provider responses. Coverage: 108 dice outcomes; 2–10 snake counts; waiting-bank timing at 2/3/6/10 players; complete three-round two-player games with Gemini, Google key alias, OpenAI and neutral responses; two-player vote rejection; retained group voting; and correction/replacement timeouts at 2/3/10 players. No live or paid API calls are made.

Local regression and Babel parse/transform checks passed. Local npm installation was blocked by an environment 403 for a tarball, so local Next build, lint, and Vitest execution are not claimed. The GitHub workflow runs those dependency-backed gates; inspect the latest commit's result.

Before calling the URL playable:

1. Complete a two-player game in two independent browser sessions against the actual test backend, using a real Gemini response. Both get explanations and beans without a human-ballot wait.
2. Complete 3-, 6-, and 10-player browser flows. Confirm valid ballots, four picks each, and one shared result per throw.
3. Bank while someone else waits, rolls, or settles. Their roll must still finish; no pot is paid twice.
4. Correct an early pick during draft and review. Replacement resumes the original turn; totals stay four picks each. Also expire a replacement turn.
5. Disconnect/reconnect the roller and host. State survives; private ideas and ballots remain private.
6. Try physical iPhone Safari: keyboard, tap targets, background/rejoin, dice animation, sharing, and Add to Home Screen.
7. Confirm test rooms are absent from production, installed branding says Beans, ties share rank, and provider secrets never enter public responses or assets.

Main PR #9's notes report a successful manual production PartyKit deploy. Its CI deploy failed because CI credentials were missing. Treat those as separate evidence; neither a frontend SHA nor that report independently proves the live backend revision.

## Promotion after Luke and Brynna approve

Integrate the Codex follow-up into test PR #12 after its checks, then refresh from main and preserve newer Fudge commits. Require the current commit's build, lint, tests, and actual multiplayer checks. Merge the reviewed PR only after approval, then build with production variables and deploy the matching production PartyKit revision. Do not blindly promote a test artifact with a compiled test-backend address. Retain previous frontend/backend revisions for rollback. No automatic merge to main.

# Beans release and preview setup

Release candidate: `codex/beans-release`, [PR #15](https://github.com/LWagnerJG/rushmore-bank/pull/15).
Production target: https://roundacats.vercel.app.

Luke authorized promotion after verification. Publish both the frontend and the PartyKit backend from the tested revision. A successful frontend build alone does not make the new multiplayer rules live.

## What is included

This release includes Fudge’s original Beans test in PR #12 and the two-player / correction fixes from PR #13. It preserves the create/join flow, Gemini provider preference, `gemini-3.5-flash` default, optional `GEMINI_MODEL`, private ballots and server-authoritative scoring. Fudge’s separate candidate in PR #14 is left untouched; its solo dice turns conflict with Luke’s later clarification to roll once and pass.

The new rules are in `docs/RULES.md`: full-balance wager slider, all players enter BANK even with zero wagered, one roll per active player in a circuit, two personal safe rolls reset each topic, and the dice round ends when everyone banks or busts. Drafting has available suggestions, a private queue, manual entry and a four-row snake board.

## Production prerequisites

| Location | Requirement |
| --- | --- |
| GitHub Actions repository secrets | `PARTYKIT_TOKEN` and `PARTYKIT_LOGIN` for the existing backend deploy workflow |
| Production Vercel public build setting | `NEXT_PUBLIC_APP_ENV=production` (normally derived from Vercel) |
| Production browser backend | `NEXT_PUBLIC_PARTYKIT_HOST=rushmore-bank.lwagnerjg.partykit.dev`, or leave unset to use that production default |
| Production Vercel server | Keep Fudge’s `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`; retain any `GEMINI_MODEL` override |
| Vercel and PartyKit | Matching `JUDGE_SECRET` for authenticated judge and suggestion requests |
| Production PartyKit | `JUDGE_URL=https://roundacats.vercel.app` |

The release branch’s deployment-access check verifies presence of the two Actions credentials without printing values. As of the initial release attempt, that check fails. An operator already logged into PartyKit can instead deploy the tested branch manually with `npx partykit deploy --config partykit.json` before promoting its frontend. Keep existing provider keys; do not put them in public browser settings.

The backend health endpoint `/parties/main/CHECK` returns `release: beans-roundrobin-v1` after this server revision is deployed. Confirm this response before calling production ready. The connected Vercel account used for this work could not access the owning project; GitHub’s Vercel integration still builds branch previews.

## Verification

On Node 24:

```bash
npm ci
npm test
npm run lint
node --experimental-vm-modules scripts/verify-beans.mjs
npm run build
```

CI also builds with a localhost backend address and plays complete three-round games in Chromium and WebKit against real local Next and PartyKit servers. It checks create/join, lobby arrivals, rejoin, private queues, snake picks, the wager slider, synchronized dice, visible pip counts, banking and carried balances. Screenshots and traces are stored in the workflow artifacts; a separate browser check includes results and selected phone screenshots. Provider calls are mocked or disabled; these checks do not claim real-key judging or a physical iPhone test.

After deployment, verify a fresh two-player room and one group room, confirm real Gemini judging, then check Safari sharing and Add to Home Screen. Keep the previous frontend and backend revision available for rollback.

## Isolated previews

The branch preview is listed by the Vercel bot on PR #15. It needs its own PartyKit host to play. Preview/test builds intentionally refuse a missing backend or the known production hostname.

For a separate preview, set `NEXT_PUBLIC_APP_ENV=test`, set `NEXT_PUBLIC_PARTYKIT_HOST` to the isolated host, and use the same test-only `JUDGE_SECRET` on both servers. Deploy `partykit.test.json` only to the existing test project after coordinating its owner, or prepare a separately named config. Set that backend’s `JUDGE_URL` to the actual preview origin. Rebuild the frontend after public environment settings change.

Do not promote an artifact compiled with a test backend into production. Do not overwrite Fudge’s `roundacats-test` while he is testing there. Legacy `stones` fields, guest storage keys and production project identifiers remain compatible.

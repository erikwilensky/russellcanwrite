# Russell Can Write

A world-map military-history campaign that trains sentence boundaries (run-ons, comma splices, commas after openers, sound-alike words) and PEAL paragraphs with clear topic sentences, for MYP English.

It is a small standalone Next.js 16 app. It has no database: Russell's progress is one JSON file.

## Run

```bash
npm ci
npm run build
PORT=3000 npm start      # serves http://localhost:3000
```

Node 20 or newer. `.npmrc` sets `legacy-peer-deps` because of a vitest peer-range quirk in npm 10.

## Settings (environment variables)

Copy `.env.example` to `.env` and fill it in.

| Variable | Needed | What it does |
| --- | --- | --- |
| `AUTH_SECRET` | yes | Any long random string. Signs the login cookie. |
| `RCW_ACCESS_CODE` | no | The 8-digit login code. Defaults to the code in `src/lib/auth.ts`. Changing it signs every device out. |
| `DATA_DIR` | yes in production | A folder that survives redeploys. Progress is saved to `DATA_DIR/save.json`. Back this file up. Defaults to `./data`. |
| `OPENAI_API_KEY` | no | Turns on the AI coach for written dispatches. Without it, dispatches are scored by the built-in rules. |
| `OPENAI_MODEL` | no | Defaults to `gpt-4o-mini`. |
| `PORT` | no | Port for `npm start`. |

The login cookie is marked `Secure` in production, so the site must be reached over HTTPS (a tunnel or reverse proxy in front of `npm start` is fine). Plain `http://localhost` also works for testing.

## Develop

```bash
npm run dev
npm test          # content, puzzle generator, analysis, progress and save-file tests
npm run typecheck
npm run lint
```

## Where things live

- `src/lib/content.ts`: every sentence, claim, PEAL paragraph and writing task. Add content here.
- `src/lib/items.ts`: puzzle generators (they break correct sentences in known ways, so every answer is certain).
- `src/lib/analyse.ts`: rule-based paragraph scoring. `src/app/api/coach/route.ts` is the optional AI coach. It asks questions and never rewrites Russell's sentences.
- `src/lib/state.ts`: XP, ranks, stars, streaks, unlocks.
- `src/components/`: the game screens.

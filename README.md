# Russell Can Write

A world-map military-history campaign that trains sentence boundaries (run-ons, comma splices, commas after openers, sound-alike words) and PEAL paragraphs with clear topic sentences, for MYP English.

It is a small standalone Next.js 16 app. It has no database: Russell's progress is one JSON file.

## Run

```bash
npm ci
npm run build
PORT=3000 npm start      # serves http://localhost:3000
```

Node 20 or newer (the Docker image uses Node 22). `.npmrc` sets `legacy-peer-deps` because of a vitest peer-range quirk in npm 10.

## Settings (environment variables)

Copy `.env.example` to `.env` and fill it in.

| Variable | Needed | What it does |
| --- | --- | --- |
| `AUTH_SECRET` | yes | Any long random string. Signs the login cookie. |
| `RCW_ACCESS_CODE` | yes in production | The 8-digit login code. With none set, nobody can sign in. Changing it signs every device out. (Local dev default: `00000000`.) |
| `DATA_DIR` | yes in production | A folder that survives redeploys. Progress is saved to `DATA_DIR/save.json`. Back this file up. Defaults to `./data`. |
| `OPENAI_API_KEY` | no | Turns on the AI coach for written dispatches. Without it, dispatches are scored by the built-in rules. |
| `OPENAI_MODEL` | no | Defaults to `gpt-4o-mini`. |
| `AI_MONTHLY_LIMIT_USD` | no | Spend cap for the AI coach per calendar month. Default `10`. |
| `AI_DAILY_CALL_LIMIT` | no | Most AI coach calls per day. Default `60`. |
| `PORT` | no | Port for `npm start`. |

The login cookie is marked `Secure` in production, so people must reach the site over HTTPS. A Cloudflare Tunnel in front of plain HTTP on 127.0.0.1 is the intended setup.

## Docker (production)

```bash
docker build -t russellcanwrite .
docker run -d --name russellcanwrite --restart unless-stopped \
  -p 127.0.0.1:3501:3000 \
  -v /path/on/host/russellcanwrite-data:/data \
  --env-file /path/on/host/russellcanwrite.env \
  russellcanwrite
```

- Inside the container the app listens on port 3000; `DATA_DIR` is `/data` (mount a host folder there and back it up).
- The image is the Next.js standalone output (about 70 MB of app on node:22-alpine). The build itself is small: it compiles in seconds and needs well under 1 GB of memory.
- Health check: `GET /api/health` returns 200 with `{"ok":true}` when `AUTH_SECRET` and `RCW_ACCESS_CODE` are set and the data folder is writable, otherwise 503 with the missing names.

## Data kept

`DATA_DIR/save.json` holds Russell's progress and the paragraphs he writes in the game (his own writing). Nothing else about him or anyone else is stored. Treat that file and its backups as private. When the optional AI coach is on, each paragraph he submits is sent to OpenAI for marking. Logs contain only errors, never his writing.

## AI spend control

The coach prices every OpenAI call from its token usage and keeps a running monthly total in `DATA_DIR/ai-spend.json`. Before each call it checks that the total plus the worst case for one more call stays within `AI_MONTHLY_LIMIT_USD`. Calls run one at a time, failed calls count at their worst case, and there are no automatic retries. Unknown models are priced high on purpose. At the cap, paragraphs are marked by the built-in rules until the month ends. On `gpt-4o-mini` a worst-case call costs about $0.0008, so even 60 calls a day all month is about $1.50. `GET /api/health` shows this month's spend.

As a second lock, also set a monthly budget on the OpenAI project that owns the key (platform.openai.com, project limits).

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

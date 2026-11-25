# Joker · ჯოკერი

A web version of the Georgian card game **Joker** that friends play together via a shared link.
No accounts, no login, no database.

```
/packages/engine   pure TypeScript game logic + Vitest tests (used by server and client)
/server            Node + Socket.IO game server, rooms kept in memory
/web               Next.js (App Router) + Tailwind client
```

## Run locally

Requires Node 20+.

```bash
npm install
npm run dev
```

That starts the Socket.IO server on **:4000** and the web app on **:3000**. Open http://localhost:3000.

To play from phones on the same Wi‑Fi, open `http://<your-computer-ip>:3000`. The client connects to
port 4000 on whatever host served the page, so no extra setup is needed.

Other scripts:

| Command | What it does |
| --- | --- |
| `npm test` | engine unit tests (Vitest) |
| `npm run typecheck` | typecheck all workspaces |
| `npm run smoke -w server` | end-to-end socket test against a running server |

## How to play in the app

1. **Create game**, enter your name and you land in the lobby at `/room/ABC123`.
2. **Copy link** and send it to friends. They enter a name and **Join**.
3. The host can fill empty seats with bots, remove players, and choose the settings.
4. The host presses **Start** when all 4 seats are filled.

Your identity is a random id stored in `localStorage`. A refresh or a short disconnect puts you back in
the same seat with the same hand. If you're gone for more than 30 s mid-game, a bot plays your turns
until you come back. Rooms with nobody connected are deleted after 30 minutes.

## Rules summary

- **Deck:** 36 cards, 6–A in ♠♣♥♦, with 6♠ and 6♣ replaced by 2 Jokers. 4 players, each for themselves. The dealer rotates clockwise.
- **Modes:**
  - *Standard* (სტანდარტული): 24 hands, pulkas 1–8, 9×4, 8–1, 9×4.
  - *Nines* (ცხრიანები): 16 hands, 9×4 in each of 4 pulkas.
- **Trump:** in hands under 9 cards, the next card from the deck is turned up (a Joker means no trump). In 9-card hands, the player after the dealer sees their first 3 cards and picks a suit or no trump.
- **Bidding:** clockwise from the player after the dealer, 0..hand size. The dealer, bidding last, may not make the bids add up to the hand size.
- **Play:** the player after the dealer leads first, then each trick's winner leads. You must follow suit; if you're void you must trump; with no trump you may play anything. A Joker may be played at any time.
- **Joker:**
  - Not led: **HIGH** wins the trick unless a later Joker is played HIGH; **LOW** loses.
  - Led: name a suit plus HIGH or LOW.
    - HIGH: everyone must play their highest card of that suit (if void: trump, else anything). The Joker wins unless someone trumps (when the named suit isn't trump) or a second Joker is played HIGH.
    - LOW: the Joker counts as the lowest card of the named suit.
- **Scoring:**
  - Exact bid: 50 × bid + 50 (a made 0 bid = 50).
  - Bid = hand size and made: 100 × tricks.
  - Over the bid: 10 × tricks.
  - Under the bid, took at least 1: 10 × tricks.
  - Bid ≥ 1 and took 0: **khishti** (−200 / −500 / −1000 / custom, set in the lobby).
  - Pulka bonus (off by default): a player who makes every bid in a pulka gets their best hand of that pulka again.

## Configuration

Every rule number lives in [`packages/engine/src/config.ts`](packages/engine/src/config.ts):

- **`RULES`**: deck, scoring, khishti options, timer options, bot delay, disconnect grace period, room expiry, name length.
- **`MODES`**: each mode is an array of pulkas, and each pulka is an array of hand sizes. Add a mode there and it shows up in the lobby; the engine needs no change. Add its label to the dictionary as `mode_<id>`.

UI text (Georgian / English) is in [`web/lib/dictionary.ts`](web/lib/dictionary.ts).

## Engine API

```ts
import { createGame, applyAction, getLegalMoves, getPlayerView, chooseBotAction } from '@joker/engine';

createGame({ players, settings, seed?, firstDealer? }): GameState
applyAction(state, action): GameState               // pure; throws IllegalActionError
getLegalMoves(state | playerView, playerId): Action[]
getPlayerView(state, playerId | null): PlayerView   // hides other hands, deck, RNG seed
chooseBotAction(state | playerView, playerId): Action
```

Actions: `{ type: 'chooseTrump', suit }`, `{ type: 'bid', bid }`, `{ type: 'play', cardId, joker?: { mode, suit? } }`.

## Security model

- The server is authoritative. Every action is rebuilt from untrusted input and checked by the engine, so `applyAction` accepts only moves listed by `getLegalMoves`.
- Each client receives only its own `getPlayerView` (never other hands, the deck or the RNG seed).
- The secret `playerId` that reclaims a seat is never broadcast. Inside a game each seat has a separate public id.
- Names are sanitized (control/markup characters removed, max 16 chars) and must be unique per room.

## Deployment

The web app and the game server deploy separately.

### Socket.IO server → Railway / Render / Fly

Deploy the repo root with:

- **Install:** `npm install`
- **Start:** `npm start -w server` (runs TypeScript directly with `tsx`)
- **Env:**
  - `PORT`: provided by the platform.
  - `CLIENT_ORIGIN`: your web URL, e.g. `https://joker.vercel.app`. A comma-separated list is allowed. If unset, all origins are allowed.
- **Health check:** `GET /health`

Rooms live in memory, so run **a single instance**. Don't autoscale it horizontally, and note that a
restart ends running games. On Render's free tier the server sleeps when idle, so the first visit takes a few seconds.

### Web → Vercel

- Import the repo and set **Root Directory** to `web`. Vercel detects Next.js and installs the workspace from the repo root.
- Env: `NEXT_PUBLIC_SERVER_URL=https://your-server.up.railway.app`

## Not yet built (phase 2)

- Spectator mode for visitors to a full or running room (currently they see "Game in progress").

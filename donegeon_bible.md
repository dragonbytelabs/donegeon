# DONEGEON BIBLE

Single source of truth for "what exists in the repo right now".

Last updated: 2026-01-16 (v0.7 complete)

## What is Donegeon?
Donegeon is a backend-first task system expressed as a game. The backend is authoritative (“backend is law”), and the frontend renders state + calls APIs.

## Monorepo layout (Bun + Turborepo)
- `package.json` (root): Bun workspaces + Turbo scripts
- `packages/docs` (`@donegeon/docs`): markdown documentation (design, decks, quests, glossary, testing)
- `packages/app` (`@donegeon/app`): shared TypeScript domain + API contract types
- `packages/backend` (`@donegeon/backend`): Hono API + in-memory engine/repositories (Bun runtime)
- `packages/frontend` (`@donegeon/frontend`): Vite + Solid SPA (TypeScript + Tailwind + Kobalte)

## Ports (local dev)
- **Backend API**: `http://localhost:3000`
- **Frontend**: `http://localhost:5173` (Vite default)
- **OpenAPI Docs (Swagger UI)**: `http://localhost:8080`

## Run commands
From repo root:

```bash
bun install
```

- Backend API:

```bash
bun run dev:backend
```

- Frontend:

```bash
bun run dev:frontend
```

- OpenAPI docs:

```bash
bun run dev:openapi
```

## OpenAPI docs
- Swagger UI: `http://localhost:8080`
- Spec JSON: `http://localhost:8080/openapi.json`

The OpenAPI spec and Swagger UI server are maintained in `packages/docs/openapi/*` so the backend can stay API-only.

## Backend architecture (current)
The backend is a **functional in-memory** port of the original Go server’s API surface.

- Entry: `packages/backend/src/index.ts`
- State container: `packages/backend/src/core/state.ts`
  - Singleton `AppState` holding repos + engine
  - Seed data: villagers, decks, buildings, a starter quest
- Engine facade: `packages/backend/src/core/engine.ts`
  - Handles cross-repo operations (complete task, day tick, open deck, clear zombie, attach modifier, etc.)
- Repos: `packages/backend/src/core/repos/*`
  - In-memory data stores (tasks, villagers, zombies, world, loot, decks, modifiers, quests, recipes, buildings, projects, cards)
- API routing: `packages/backend/src/routes/*`
  - Hono routers mounted under `/api/*`
- Adapter client types live in `packages/backend/src/todoist/*` but are **named generically** (`TaskApiClient`, `TaskApiConfig`) because Donegeon is more than a task manager.

## Frontend architecture (current)
- Vite + Solid SPA in `packages/frontend`
- Tailwind wired via `packages/frontend/tailwind.config.cjs` + `packages/frontend/postcss.config.cjs`
- Kobalte installed (`@kobalte/core`)
- Dev proxy: `packages/frontend/vite.config.ts` proxies `/api/*` → `http://localhost:3000`
- Current UI: `packages/frontend/src/app.tsx` is a minimal dashboard that loads core game state and can drive key actions (create task, day tick, open first-day deck, work tasks, clear zombies).
- Frontend state pattern: `solid-js/store` `createStore` + `produce` (immutable-style updates).
  - API helper: `packages/frontend/src/lib/api.ts`
  - Store: `packages/frontend/src/state/gameStore.ts`

## Frontend routes (v0.4)
- `/`: dashboard (`packages/frontend/src/app.tsx`)
- `/board`: board (camera + deck dock) (`packages/frontend/src/routes/Board.tsx`)
 - `/tasks`: task list view (`packages/frontend/src/routes/Tasks.tsx`)

## v0.1 rules-first direction
- Core **business rules** live in `@donegeon/app` under `packages/app/src/rules/*` (pure, deterministic, testable).
- v0.1 focus: **deck opening + loot/progression** rules.
- Backend remains authoritative but delegates deck open rules to `@donegeon/app/rules`.

Key files:
- Rules: `packages/app/src/rules/decks.ts`, `packages/app/src/rules/balance.ts`
- DTO: `packages/app/src/api/game.ts` includes `DeckOpenTransitionDto`
- Backend integration: `packages/backend/src/core/engine.ts` (`openDeck`)
- Frontend consumption: `packages/frontend/src/state/gameStore.ts` + `packages/frontend/src/app.tsx`

## v0.2 board MVP
- Board rules live in `@donegeon/app` under `packages/app/src/rules/board/*` (snapping + legality + `applyMove`).
- Frontend `/board` uses those rules for drag/drop.
- Deck open animation uses backend `DeckOpenTransitionDto` offsets to fan-out cards clockwise.

## v0.3 legacy board direction
- Board state is now **persisted server-side in-memory** and keyed by `X-Donegeon-Player` header.
- `/api/board/*` endpoints manage board entities, stacking, unstacking, and deck opening.
- Frontend `/board` renders **legacy-like cards** via `packages/frontend/src/board/legacy/Card.tsx` and shows stacks as vertical columns.
- Bottom “deck dock”: fixed deck cards at the bottom (e.g. **Collect** drop target + **First Day** spawn deck) to match the legacy feel and avoid “button UI”.

Key files:
- Shared DTOs: `packages/app/src/api/game.ts` (`BoardStateDto`, `BoardEventDto`)
- Board rules: `packages/app/src/rules/board/*`
- Backend: `packages/backend/src/routes/board/index.ts`, `packages/backend/src/core/repos/boardRepo.ts`
- Frontend: `packages/frontend/src/routes/Board.tsx`, `packages/frontend/src/board/legacy/Card.tsx`, `packages/frontend/src/lib/boardApi.ts`, `packages/frontend/src/lib/playerId.ts`

## v0.4 board UX + hybrid sync
- `/board` now uses an **infinite canvas camera**: right-drag pans, mouse wheel zooms; entities are rendered in world coordinates inside a transformed “world layer”.
- Deck dock is populated from `GET /api/decks` and includes locked overlays + unlock progress. `organization` is presented as **Modifiers** in the dock UI.
- Frontend uses a board-local store to smooth UX while keeping server as source of truth:
  - Store: `packages/frontend/src/state/boardStore.ts` (`createStore` + `produce`)
  - Policy: optimistic local moves, then **reconcile to server**, plus a periodic pull when idle (server wins).

## v0.5 Stacklands-style UI polish
- Bottom-right **notifications** (toast stack) driven by backend board `events`:
  - Store: `packages/frontend/src/state/notificationsStore.ts`
  - UI: `packages/frontend/src/components/Notifications.tsx`
  - Wired from: `packages/frontend/src/state/boardStore.ts`
- Deck dock moved **outside** the play area as a bottom HUD row (fixed-size).
- Added a visible affordance: “Right-drag to pan • Wheel to zoom”.

## v0.6 Stacklands delta
- **Play area clipping**: world entities are clipped to the board rectangle; you won't see "floating cards outside" until you pan there.
- **Dock sizing**: dock cards are ~70% size via `LegacyDeckCard size="dock"`.
- **Quest panel**: left sidebar can switch between `Quests` and `Today`, using:
  - `GET /api/quests/active`
  - `GET /api/quests/daily`
- **Quest completion toasts (MVP)**: client polls `GET /api/quests` and pushes a toast when a quest transitions to `status: "complete"`.
- **Sell slot + zone hit-testing**:
  - New endpoint: `POST /api/board/sell` removes a card from board and awards loot (default: +1 coin).
  - Frontend shows a **Sell** slot beside **Collect** and highlights slots when hovering during drag.
- **No-overlap solver (MVP)**: on drop, client nudges to nearest open space to avoid overlapping cards (unless stacking).
- **Progress bar support**: `LegacyCard` can render a thin progress bar when `progress` is provided (currently wired for task payloads that include `work_progress`).
- **Minimap**: board minimap with viewport rectangle + click-to-pan.
- **Camera polish**: inertia pan after right-drag release.
- **SQLite board persistence** (backend):
  - `BoardRepo` persists `BoardStateDto` keyed by `playerId` into SQLite (default path `./.data/donegeon.sqlite`).
  - Env var override: `DONEGEON_DB_PATH=/path/to/db.sqlite`
  - `.data/` is gitignored.

## v0.7 Gameplay + Zones (current)
- **Villagers on board (auto-spawn)**: When a player's board is empty, 2 initial villager cards are auto-spawned near the origin. This ensures the sidebar "villagers" count matches visible board entities from the start.
- **Trash zone**: New `POST /api/board/trash` endpoint removes cards from the board (no reward). Frontend shows a **Trash** slot in the dock with rose highlight on hover. Cannot trash villagers.
- **Balance config economy**: `packages/app/src/rules/balance.ts` now includes:
  - `sellCardCoinReward`: default coin reward for selling non-loot cards (1 coin)
  - `sellLootPassthrough`: if true, selling loot cards gives their loot value instead of coins (default: true)
  - `workTimerDurationMs` / `gatherTimerDurationMs`: timer durations for work/gather (4500ms / 5500ms)
  - `workRewardCoin` / `gatherRewardCoin`: coin rewards for completing timers (1 coin each)
- **Server-driven timer durations**: Work/gather timers use `defaultBalance` config values instead of hardcoded durations.
- **Server-driven rewards**: Timer completion rewards are determined by balance config.
- **Unified drop pipeline**: Frontend `Board.tsx` resolves drops in order: (1) dock zones (collect/sell/trash), (2) stack preview target, (3) move.
- **Persistence hardening**: SQLite schema versioning with `_schema_meta` table tracking version. Migrations are applied automatically on startup. Current schema version: 1.
- **Per-player isolation tests**: `packages/backend/src/core/isolation.test.ts` verifies board state isolation per player. Loot/villager/task isolation requires further refactoring (noted as limitation).
- **Keyboard shortcuts**: Already implemented in v0.6, now documented:
  - `?` - Show help
  - `Esc` - Clear selection / close help
  - `0` - Reset zoom to 1x
  - `c` - Center camera on (boardWidth/2, boardHeight/2)
- **Work/gather loop MVP**: Already implemented in v0.6, now documented: Dropping a villager onto a task/resource card starts a work/gather timer. Completion spawns a coin loot card reward near the worksite and clears the villager's `working_on` pointer.
- **Villager "active" visuals**: Frontend checks `working_on` payload field to show active state (shimmer/glow) on villager cards.
- **Selection + multi-drag**: Already implemented in v0.6, now documented: Shift-click to multi-select, drag selection to move group together.
- **Stack interaction polish**: Hover preview shows whether cards can stack (green ring) or not (red ring). Feedback via notifications when attempting incompatible stack.
- **Deck open animation v2**: Server emits `deck_open_fanout` events with offsets; frontend animates cards from deck origin to fan-out positions using CSS transitions.
- **Quest completion flow**: `claimQuest` action in `boardStore.ts` calls `POST /api/quests/:id/complete` and shows reward toasts.
- **Server-driven wiggle animation**: Backend emits `wiggle` events when it nudges a card to an open spot during move conflicts. Frontend animates the wiggle visually using CSS transitions (280ms ease-out).
- **Quest progress events**: Quest system now emits server events when quests complete, instead of client-side polling and diff detection. `POST /api/quests/refresh` returns events array with quest state changes.
- **Board entity bounds model**: `packages/app/src/rules/board/bounds.ts` provides canonical sizing for collision/hover/minimap (120x160 for all entities currently).
- **Zone system (true zones)**: Complete zone implementation in `packages/app/src/rules/board/zones.ts` with `applyCollectZone`, `applySellZone`, and `applyTrashZone` functions. Each returns typed results with loot deltas and events.
- **OpenAPI board coverage**: All board endpoints (`/api/board/*`) are now fully documented in `packages/backend/openapi.yaml` with request/response schemas for `BoardState`, `BoardEntity`, `BoardEvent`, `BoardTimer`, and `BoardActionResult`.
- **Frontend perf optimizations**: 
  - Helper functions (`emojiForEntity`, `titleForEntity`, etc.) moved outside component to avoid re-creation on every render
  - Minimap entity rendering capped at 100 entities for large boards
  - Drag operations use `batch()` to reduce re-renders during pointer move
  - Optimistic move batching during multi-entity drag

## Implemented features (current)

### Core API routes
The backend implements the Go snippet’s endpoints (functional in-memory). Key groups:

- **Tasks**
  - List/create tasks
  - Tag/priority
  - Move inbox → live
  - Process work (stamina + progress) and complete tasks
  - Assign to villager
  - Attach/detach/list modifiers
  - Basic reorder (no-op placeholder)

- **Villagers**
  - List villagers
  - Stamina is consumed for task assignment and task processing, and resets on day tick

- **Zombies**
  - List zombies
  - Day tick can spawn zombies (currently: inbox-neglect model)
  - Clear zombie endpoint

- **World / Day tick**
  - `POST /api/day/tick`: advances day, resets stamina, updates penalties, spawns zombies
  - `GET /api/world`: returns world state

- **Loot / Inventory**
  - `GET /api/loot`
  - `POST /api/loot/collect`
  - Task completion generates minimal loot; deck opening can generate loot drops too

- **Decks**
  - `GET /api/decks` includes unlock meta (tasks_processed thresholds)
  - `GET /api/decks/:id/preview`
  - `POST /api/decks/:id/open`
  - Deck contents are based on `packages/docs/DECKS.md` (lightweight approximation)

- **Board**
  - `GET /api/board/state`: Get per-player board state (auto-spawns initial villagers if empty)
  - `POST /api/board/spawn-deck`: Spawn a deck entity on the board
  - `POST /api/board/move`: Move an entity (with stack support)
  - `POST /api/board/stack`: Stack two cards together
  - `POST /api/board/unstack`: Unstack a stack
  - `POST /api/board/open-deck`: Open a deck entity, spawning cards
  - `POST /api/board/collect`: Collect a loot card (adds to inventory)
  - `POST /api/board/sell`: Sell a card (awards loot based on balance config)
  - `POST /api/board/trash`: Trash a card (removes from board, no reward)
  - `POST /api/board/start-work`: Villager starts working on task/resource (timer)
  - `POST /api/board/tick`: Check and complete expired timers, spawn rewards
  - `POST /api/board/assign-task`: Assign task to villager (legacy API)
  - `POST /api/board/complete-task`: Complete a task (legacy API)
  - `POST /api/board/clear-zombie`: Clear a zombie (legacy API)
  - `POST /api/board/feed`: Feed a villager to restore stamina

- **Modifiers**
  - List modifiers
  - Create+attach modifier to a task
  - Attach existing modifier card
  - Waiting-on / checklist / review-cadence update endpoints (supported; some fields are placeholder-driven)

- **Quests**
  - List quests, list active, list daily
  - Complete/claim a quest (starter quest exists)
  - Refresh quest progress (minimal placeholder service)
  - Sell board card: `POST /api/board/sell` (v0.6)

- **Recipes**
  - List recipes
  - Craft recipe (placeholder reward)

- **Buildings**
  - List buildings
  - Construct building (sets to built)

- **Projects**
  - List/create/archive projects
  - Assign task → project

- **Game / Cards / Dev**
  - `/api/game/state`, `/api/game/remaining-undrawn`, `/api/cards`, `/api/cards/zone/:zone`, `/api/dev/config`, `/api/dev/stats`
  - Some endpoints currently return minimal placeholder data (e.g. remaining-undrawn, telemetry stats, cards)

### OpenAPI coverage
OpenAPI spec includes the current endpoint paths (summary-level) with comprehensive schemas for request/response bodies.

**v0.7 status**: ✅ Complete. All board endpoints (`/api/board/*`) are fully documented in `packages/backend/openapi.yaml` including:
- All 11 board action endpoints (state, spawn-deck, move, stack, unstack, open-deck, collect, sell, trash, start-work, tick, feed)
- Complete schema definitions for `BoardState`, `BoardEntity`, `BoardEvent`, `BoardTimer`, `Stack`, and `BoardActionResult`
- Request/response body schemas with proper types and descriptions
- Event variant schemas covering all 11 event types (wiggle, stacked, unstacked, collected, consumed, sold, trashed, quest_completed, timer_started, timer_completed, deck_open_fanout)

## Tests
Backend has an automated “hit every endpoint” smoke test suite (in-memory request execution) to ensure all routes respond and basic flows work.

### 30-day simulation test (game-like)
There is also a deterministic **30-day API-driven simulation** test that plays the game via endpoints (open decks, create tasks, assign/process, attach modifiers, day ticks, clear zombies, etc.).

- Test: `packages/backend/src/sim/simulation_30d.test.ts`
- Run:

```bash
bun run --filter @donegeon/backend test
```

## Dependency management (Bun Catalogs)
All third-party dependency **versions** are defined in the **root** `package.json` under `catalog`, and workspace packages reference them using the `catalog:` protocol.

Rule: when adding a new dependency, add its version **only** to the root `catalog`, then reference it in packages as `catalog:`.

See Bun docs: [`https://bun.com/docs/pm/catalogs`](https://bun.com/docs/pm/catalogs)

## Maintenance rule (important)
Any time a new feature/functionality is added or changed, **update this file** to reflect:\n+- New/changed endpoints\n+- New/changed packages/scripts\n+- New/changed game rules/engine behaviors\n+- Any new environment variables or ports\n+

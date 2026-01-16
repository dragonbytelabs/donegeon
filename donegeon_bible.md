# DONEGEON BIBLE

Single source of truth for “what exists in the repo right now”.

Last updated: 2026-01-15

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

- **Modifiers**
  - List modifiers
  - Create+attach modifier to a task
  - Attach existing modifier card
  - Waiting-on / checklist / review-cadence update endpoints (supported; some fields are placeholder-driven)

- **Quests**
  - List quests, list active, list daily
  - Complete/claim a quest (starter quest exists)
  - Refresh quest progress (minimal placeholder service)

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
OpenAPI spec includes the current endpoint paths (summary-level), and should be expanded with request/response schemas as behaviors stabilize.

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

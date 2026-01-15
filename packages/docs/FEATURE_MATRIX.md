# Donegeon Feature Matrix (Spec vs Code)

This is a practical “what exists today?” map of [`donegeon.md`](./donegeon.md) to code paths.

Legend: **implemented** / **partial** / **missing**

---

## 1) Core Philosophy: Backend is authoritative

- **Status**: **implemented**
- **Backend**: Rules live in `internal/game/engine.go` and are exposed via `internal/server/api.go`.
- **Frontend**: Primarily renders state + calls API (`web/src/pages/BoardPage.tsx`, `web/src/lib/api.ts`).
- **Notes**: There are still a few frontend-only “recipes” (example: Food + Modifier enhancement logic in `BoardPage.tsx`) which violates “backend is law” if kept long-term.

---

## 2) Task system (Todoist-like)

### 2.1 Task lifecycle: inbox → live → completed → archived
- **Status**: **implemented**
- **Backend**:
  - Model: `internal/task/task.go`
  - Zones: `task.ZoneInbox`, `task.ZoneLive`, `task.ZoneCompleted`, `task.ZoneArchived`
  - Move to live: `POST /api/tasks/move-to-live` and `POST /api/tasks/process` (`internal/server/api.go`)
  - Complete: `POST /api/tasks/complete` → `Engine.CompleteTask` (`internal/game/engine.go`)
- **Frontend**:
  - Board uses task lists + cards: `web/src/pages/BoardPage.tsx`

### 2.2 Create / update
- **Status**: **partial**
- **Backend**:
  - Create: `POST /api/tasks`
  - Update fields: tags (`POST /api/tasks/tag`), priority (`POST /api/tasks/priority`), project (`POST /api/tasks/set-project`)
  - “Edit title/description” endpoint is not clearly present as a dedicated update route (task update is internal repo API).
- **Frontend**:
  - Blank task card UX exists, but full “inline edit modal” (roadmap) is **missing**.

### 2.3 Due dates
- **Status**: **partial**
- **Backend**:
  - Deadline is modeled primarily via **modifier** (`deadline_pin`) in `internal/modifier/card.go`.
  - Zombie spawn checks deadline modifier in `Engine.DayTick` (`internal/game/engine.go`).
- **Frontend**:
  - Modifier attachment supported; “Thursday meaning due on Thursday” is not a first-class concept—currently it’s a timestamp.

### 2.4 Recurrence
- **Status**: **partial**
- **Backend**:
  - Recurring modifier contract (`recurring_contract`) with `RecurringEveryDays` + `RecurringNextAt` in `internal/modifier/card.go`.
  - DayTick consumes charges / spawns zombies on empty charges; engine also has “completed recurring tasks spawn new instances” logic in `Engine.DayTick`.
- **Frontend**:
  - Can attach recurring modifiers.
  - “Automatically renew weekly without reconfiguration” exists in spirit but needs deterministic rules + better tests.

### 2.5 Projects (containers only)
- **Status**: **implemented**
- **Backend**: `internal/project/*`, `GET/POST /api/projects`, `POST /api/tasks/set-project`
- **Frontend**: basic project views exist; “projects are not decks” matches spec.

### 2.6 Tags + Priority
- **Status**: **partial**
- **Backend**:
  - Tags: `POST /api/tasks/tag`
  - Priority: `POST /api/tasks/priority`
- **Frontend**:
  - Board has tag editor UI pieces; full filter/search behavior is partial.

---

## 3) Cards (Stacklands-like)

### 3.1 Card types
- **Status**: **implemented/partial**
- **Backend**:
  - There is a `game.CardRepository` + card models under `internal/game/card.go` (board cards exist).
  - Deck open creates some board cards (modifiers) in `Engine.OpenDeck`.
- **Frontend**:
  - Card rendering/drag/stack is mainly in `web/src/pages/BoardPage.tsx`.

### 3.2 Stacking rules
- **Status**: **partial**
- **Spec**: “Cards can stack only if backend allows”
- **Frontend today**:
  - Handles stack parenting locally (`parentId`) in `BoardPage.tsx`
  - Calls API for some actions:
    - Task + Villager: `POST /api/tasks/assign`
    - Modifier + Task: `POST /api/tasks/modifiers/attach`
    - Task + Task: `POST /api/recipes/execute` (note: endpoint must exist to truly support this)
- **Gap**:
  - Several “stack/recipe” outcomes are still frontend-driven or not consistently validated by backend.

---

## 4) Modifiers

### 4.1 Implemented modifier types
- **Status**: **partial**
- **Backend**: `internal/modifier/card.go` includes:
  - `recurring_contract`, `deadline_pin`, `schedule_token`, `importance_seal`
  - plus v0.2-ish types already present: `waiting_on`, `next_action`, `review_cadence`, `checklist`
- **Frontend**: recognizes these icons and renders status.

### 4.2 Charges + spent + salvage
- **Status**: **partial**
- **Backend**:
  - `modifier.Card.Normalize()` + `Spent()` logic in `internal/modifier/card.go`
  - Salvage currently occurs during `Engine.CompleteTask` (spent modifiers attached to task) in `internal/game/engine.go`
- **Frontend**:
  - Spent display exists (gray-out) in `BoardPage.tsx`
- **Gaps**:
  - No explicit “salvage action” / “recharge action” surfaced as player actions yet.

---

## 5) Villagers (stamina/time scarcity)
- **Status**: **implemented/partial**
- **Backend**:
  - Model: `internal/villager/*`
  - Stamina resets on `DayTick`
  - Assignment endpoints exist (`/api/tasks/assign`, `/api/tasks/process`)
- **Frontend**: Drag villager onto task triggers assign call.
- **Gaps**:
  - Some stamina costs are hardcoded in API handler (tag-based stamina costs) instead of config-driven.

---

## 6) Zombies (pressure from neglect)
- **Status**: **implemented/partial**
- **Backend**:
  - Spawn rules in `Engine.DayTick`:
    - deadline missed
    - important ignored too long
    - recurring has no charges
  - Cap per day: `Config.MaxZombiesPerDay`
  - Clear zombie: `POST /api/zombies/clear` → `Engine.ClearZombie`
- **Frontend**: drag villager onto zombie clears it (`api.clearZombie(zombie.id, 2)`).
- **Gaps**:
  - Telemetry coverage for spawn/clear exists as types but not fully recorded everywhere.

---

## 7) Time system (Day Tick)
- **Status**: **implemented**
- **Backend**:
  - `POST /api/day/tick` → `Engine.DayTick`
  - Applies: villager reset, zombie spawns, penalties (`loot_penalty_pct`, `pack_cost_pct`), tired status.

---

## 8) Economy (loot, coins, decks)

### 8.1 Loot drops from tasks
- **Status**: **implemented**
- **Backend**:
  - `Engine.CompleteTask` rolls loot tables by inferred task type.
  - Zombie penalty applies to loot via world state.

### 8.2 Decks
- **Status**: **implemented/partial**
- **Backend**:
  - Deck definitions and random draw: `internal/deck/deck.go`
  - Open: `POST /api/decks/{id}/open` → `Engine.OpenDeck`
  - Cost scaling with zombies: world `PackCostPct`
- **Gaps**:
  - Determinism/seeded runs (roadmap) are currently not implemented; many draws seed from `time.Now()`.

---

## 9) Quests
- **Status**: **partial**
- **Backend**:
  - Quest system exists (`internal/quest/*`) and API routes exist (`/api/quests`, `/api/quests/active`, `/api/quests/refresh`, `/api/quests/{id}/complete`).
  - `DayTick` calls `QuestService.ProcessDayEnd`.
- **Frontend**: quests are fetched and rendered; full onboarding/tutorial “starter week” is partial.

---

## 10) Board persistence (positions cosmetic, stored locally)
- **Status**: **partial**
- **Spec**: localStorage stores layout only.
- **Frontend**: local layout/persistence exists in various helpers in `BoardPage.tsx`.
- **Gap**: “store positions per save_id” (roadmap) missing.


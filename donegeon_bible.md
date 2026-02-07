# Donegeon Bible (living design doc)

> **Purpose:** This file is the single place to record product + engineering decisions for Donegeon as we build.  
> If a decision changes, update the relevant section and add a short entry to the **Decision Log**.

---

## 1) Product shape

### Routes
- `/` — marketing page, with a primary CTA to `/tasks`.
- `/tasks` — inbox-style task list (Todoist-like). Creates tasks into **Inbox** by default.
- `/board` — Stacklands-style board where tasks are represented as **stacks of cards** (task + modifiers + assigned villager).

### Core metaphor
- A **Task** is a *stack*:
  - base card: `task` (editable title/description)
  - modifier cards: e.g. deadline pin, next action, recurring/repeat, etc.
  - assignment: a `villager` card attached to the stack (the villager represents the user/assignee)

---

## 2) Architecture decisions

### Go is the source of truth
- All models, rules, validations, and state transitions live in Go.
- The frontend must not invent rules; it only renders + forwards user intent to the server.

### templ for views, minimal TypeScript for interaction
- templ renders:
  - the board shell (sidebar + top bar + canvas)
  - current stacks and their cards as HTML
- minimal TS handles:
  - pointer interactions (drag stack, pan board, context menu)
  - “optimistic” visual movement while dragging
  - POSTing commands to the server on commit (drop, merge, split, etc.)
  - applying server patches (authoritative state)

### Card stacking primitives: “port, don’t depend”
- `llm.md` describes a third-party TypeScript core (Engine + Stack operations) that we treat as a **behavioral spec**.
- We implement the same operations in Go with the same boundaries:
  - soft failures return `nil/[]`
  - invalid argument shapes are “hard” failures (panic/error)
- This avoids embedding the TS engine in the hospital runtime while still matching the proven semantics.

---

## 3) Domain model (Go)

### Entities
- `Card`
  - `ID string`
  - `Kind string` (task, villager, modifier, resource_node, etc.)
  - `DefID string` (stable identifier, e.g. `deadline_pin`)
  - `Data map[string]any` (task title/description, due date, etc.)
- `Stack`
  - `ID string`
  - `Pos {X,Y int}`
  - `Z int`
  - `Cards []CardID` (bottom -> top)
- `BoardState`
  - `Stacks map[StackID]*Stack`
  - `Cards map[CardID]*Card`
  - `NextZ int`
  - `Pan {X,Y int}` (optional, if we want per-user saved pan)

### Constraints (validated in Go)
- Task zone defaults to `inbox` (server assigns on create).
- Max modifiers per task: `4`.
- Duplicate modifier types: disallowed unless allowlisted.
- Some modifiers can be globally unique (e.g. `next_action`).

---

## 4) Server APIs (minimal set)

> All endpoints are **idempotent** where possible and return authoritative state (or a patch).

### Read
- `GET /board`  
  Server-rendered board (templ), includes initial JSON snapshot (or version token).
- `GET /api/board/state`  
  Returns JSON state: stacks, cards, current version.

### Commands (write)
- `POST /api/board/cmd`
  - body: `{ "cmd": "...", "args": {...}, "clientVersion": "..." }`
  - response: `{ "ok": true, "newVersion": "...", "patch": {...} }`

Supported commands (v0.1):
- `stack.move` `{ stackId, x, y }`
- `stack.bringToFront` `{ stackId }`
- `stack.merge` `{ targetId, sourceId }`
- `stack.split` `{ stackId, index, offsetX, offsetY }`
- `stack.unstack` `{ stackId, positions: [{x,y}, ...] }`

Later (when tasks are persisted):
- `task.create_blank` `{ x, y }`
- `task.set_title` `{ taskCardId, title }`
- `task.set_description` `{ taskCardId, description }`
- `task.add_modifier` `{ taskStackId, modifierDefId }`
- `task.assign_villager` `{ taskStackId, villagerId }`

---

## 5) Board UX decisions (Stacklands-like)

### Visual layout
- Left sidebar: “Quests / Ideas” style list (tasks, filters, decks).
- Top bar: “packs/decks” buttons.
- Main canvas: parchment background, subtle dot grid, stacks placed absolutely.

### Interactions
Desktop:
- Drag top card/stack with left mouse.
- Pan with right mouse drag on empty space.
- Shift+drag to split/pop (advanced interaction).
- Context menu for split/unstack on right click (optional).

Touch:
- One-finger drag empty space to pan.
- Drag top card/stack with movement threshold.
- Long-press opens menu for split/unstack.

### Grid + snapping
- Board uses a snap grid so stacks feel “placed”, not floaty.
- Snap on drop; server is authoritative.

---

## 6) UI building blocks (templUI Pro)

We will compose the board using existing blocks from `templ.md`:
- Sidebar layout patterns (inset sidebar with trigger + content area).
- Navbar/top bar patterns for a sticky header.

We do **not** modify `templ.md`; we only copy/compose blocks in our app and adjust Tailwind classes as needed.

---

## 7) Config as canon

`donegeon.config.yaml` is canonical for:
- allowed task zones and default zone
- modifier rules (max modifiers per task, uniqueness, charges)
- stacking rules (allowed pairs, disallowed pairs)
- UI hints (highlight rules and default spawn layout)

The backend must enforce these; the frontend may only display hints.

### Modifier consumption reference
- Source of truth: `donegeon_config.yml` -> `modifiers.types[].charges`.
- Rule fields:
  - `mode` (`finite` | `infinite`)
  - `max_charges`
  - `consume_on` (e.g. `task_complete`, `task_process`, `day_tick`)
  - `spent_behavior` (`remove` | `salvageable` | `persist_spent`)
- Current single-use on task completion:
  - `next_action` (`finite`, `max_charges: 1`, consumes on `task_complete`, spent behavior `remove`)
- Current multi-use / persistent examples:
  - `deadline_pin` (infinite, no consume events)
  - `recurring_contract` (finite 4, consumes over multiple events)
  - `importance_seal` (finite 3)
  - `schedule_token` (finite 2, process-time consumption)
  - `context_filter` (finite 5, process-time consumption)

---

## 8) Decision log

### 2026-01-31
- Implemented Go domain models: `Card`, `Stack`, `BoardState` in `internal/model/`
- Added board API endpoints: `GET /api/board/state`, `PUT /api/board/state` (sync), `POST /api/board/cmd`
- Implemented all v0.1 stack commands: `stack.move`, `stack.merge`, `stack.split`, `stack.unstack`, `stack.bringToFront`
- Implemented task commands: `task.create_blank`, `task.set_title`, `task.set_description`, `task.add_modifier`, `task.assign_villager`
- File-based persistence for board state in `data/boards/`
- IndexedDB (idb) stores board state in browser for offline/optimistic updates
- Frontend syncs state to server on load via `PUT /api/board/state`
- Board task cards sync to task repository (appear in `/tasks` view)
- Validation rules enforced server-side: max modifiers, duplicate rules, global uniqueness, stacking rules

### 2026-02-07
- Added plugin marketplace foundation with runtime manifest registration (no restart), user-scoped installs, and coin-cost install gating.
- Added core integration plugin manifests (`Google Calendar`, `Apple Calendar`, `Notion`, `Todoist`, `Jira`, `Zapier`) plus community plugin registration.
- Installed plugins can spawn integration cards (`mod.plugin_*`) onto the board via `/tasks` marketplace controls.
- Added onboarding + team setup flow with `/onboarding` gate after OTP; users must complete profile/team setup before `/tasks` and `/board`.
- Added calendar export for tasks via `GET /api/tasks/{id}/calendar.ics` and wired export buttons in both `/tasks` list and board task modal.

### 2026-01-30
- IndexedDB (idb) stores board state in browser for offline persistence
- Frontend-only persistence accepted; Go syncs only task data for now
- Board state saved: stacks, positions, z-index, card arrangements

### 2026-01-25
- Go is the source of truth; templ renders HTML; minimal TS for pointer interactions.
- The TypeScript engine described in `llm.md` is treated as a **spec**; we implement the same stack ops in Go.
- `/board` is Stacklands-like: sidebar + top deck bar + canvas with absolute-positioned stacks.

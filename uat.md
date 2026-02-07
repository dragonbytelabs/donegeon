# Donegeon UAT + Verification Runbook

Last updated: 2026-02-07

## Purpose

Use this document as the single runbook for:

1. Verifying core product behavior end-to-end.
2. Running automated quality gates.
3. Determining release readiness with objective pass/fail criteria.

## Release Exit Criteria

All must pass:

1. `./scripts/qa_gate.sh 90` passes.
2. Manual UAT checklist sections marked pass with evidence links.
3. No open P0 defects in `docs/p0_defects.md`.
4. Data durability checks pass (refresh, logout/login, server restart).

Important:

- The coverage threshold is configured at **90%** in the gate by default.
- Current baseline may be lower; the gate will fail until coverage is raised.
- This is intentional so quality debt is visible.

## What Is Automated Today

## A. Full QA Gate

```bash
./scripts/qa_gate.sh 90
```

Runs:

1. API smoke/integration suites (`scripts/uat_smoke.sh`).
2. Go coverage gate (`scripts/coverage_gate.sh`).
3. Frontend production build (`bun run build`).
4. Static bundle existence checks in `static/js`.

Artifacts:

- `.artifacts/coverage/coverage.out`
- `.artifacts/coverage/coverage.func.txt`
- `.artifacts/coverage/go-test.log`

## B. Smoke Only

```bash
./scripts/uat_smoke.sh
```

Covers:

1. Auth/session/onboarding route protection.
2. Board command regressions (task sync, merges, completion, loot collect, zombie/day tick, resource gather, food consume).
3. Task/player/plugin/quest handler suites.

## C. Coverage Gate Only

```bash
./scripts/coverage_gate.sh 90
```

## D. Taskfile Shortcuts

```bash
task uat-smoke
task coverage-gate THRESHOLD=90
task qa-gate THRESHOLD=90
```

## Manual UAT Checklist (Comprehensive)

Use one test account per run and capture evidence (screenshot or short recording) for each section.

Status keys:

- `[ ]` Not run
- `[P]` Pass
- `[F]` Fail

---

## 1) Auth + Onboarding + Team

- [ ] Request OTP, verify OTP, confirm authenticated session.
- [ ] Unauthenticated `/tasks`, `/board`, `/builder` redirect to `/login`.
- [ ] First authenticated visit redirects to `/onboarding`.
- [ ] Complete onboarding with display name + team name.
- [ ] After onboarding, `/app` redirects to `/tasks`.
- [ ] Team HQ in `/tasks`:
  - [ ] Edit team name/avatar persists after refresh.
  - [ ] Invite email appears in members list after refresh.

Expected:

- No 401/403 for authenticated pages after onboarding.
- Onboarding does not reappear once complete.

---

## 2) Task List Integrity (`/tasks`)

- [ ] Create task with title/description only.
- [ ] Edit task fields and refresh page; values persist.
- [ ] Mark task done in pending view, confirm appears in completed view with all fields intact.
- [ ] Unmark done in completed view, confirm task returns to pending with full data intact.
- [ ] `Live only (board tasks)` filter correctly includes board-created tasks.
- [ ] `On Board` state appears immediately when task is board-live.
- [ ] Calendar button behavior:
  - [ ] `Calendar` enabled when due date exists.
  - [ ] `No Date` disabled when due date missing.

Expected:

- No data loss between pending/completed transitions.
- No stale or duplicated loot indicator values.

---

## 3) Board Interactions (`/board`)

- [ ] Create blank task card; board remains interactive (no freeze).
- [ ] Open task modal, save title/description, close/reopen; values persist.
- [ ] Refresh page; board state and task card content persist.
- [ ] Merge/stack behavior:
  - [ ] Task remains face/bottom anchor card in merged stack.
  - [ ] Modifier can stack onto task (including task+villager stacks).
  - [ ] Same-type modifier stacks can merge.
- [ ] Collect deck behavior:
  - [ ] Blank task cards collect into loot.
  - [ ] Modifier cards collect into configured salvage loot.
  - [ ] Resource cards collect only when collectible (correct rejection otherwise).
- [ ] Drag/drop does not teleport receiving stack unexpectedly.

Expected:

- No `these card types cannot be stacked together` errors for valid pairs.
- No disappearing villagers/decks during normal actions.

---

## 4) Task <-> Board Roundtrip

- [ ] Board-created task appears in `/tasks` with live status.
- [ ] `/tasks` task can be moved to board via `To Board` button (cost applied).
- [ ] Task modifiers configured in `/tasks` spawn as matching modifier cards on board.
- [ ] Completing task from board:
  - [ ] task card removed,
  - [ ] single-use modifiers removed,
  - [ ] persistent modifiers remain if configured,
  - [ ] villager survives as separate stack.

Expected:

- Task data model and card stack state remain synchronized.

---

## 5) Economy + Unlock Gates

- [ ] Verify modifier field gates in `/tasks` (due date, recurrence, next action) are locked by default.
- [ ] Unlock each feature with loot; confirm immediate UI enablement and persistence.
- [ ] Verify `To Board` spawn consumes configured coin cost.
- [ ] Verify deck install/open costs scale as configured.

Expected:

- No bypass of locked features without unlock or equivalent modifier attachment.

---

## 6) Day Tick + Zombies + Villager Loop

- [ ] Create overdue task(s), run `End Day`, verify zombie spawn chance behavior.
- [ ] Confirm end-day notification includes spawned zombie count and overdue count.
- [ ] Drag villager onto zombie, clear zombie, verify:
  - [ ] zombie removed,
  - [ ] stamina consumed,
  - [ ] reward granted,
  - [ ] notification shown.
- [ ] Confirm recurring completed tasks respawn to pending on day tick when due.
- [ ] Confirm end-day recurring respawn notification appears.

Expected:

- Overrun danger reflects active zombies.
- Metrics (`zombies_seen`, `zombies_cleared`) update correctly.

---

## 7) Resources, Mining, Food, Stamina, Leveling

- [ ] Drag villager onto `berry_bush`/`mushroom_patch`/`scrap_pile`.
- [ ] Confirm activity bar appears and completes.
- [ ] Confirm gather outputs spawn (food/loot/parts/gear paths).
- [ ] Drag food onto villager and verify stamina restoration + food consumption.
- [ ] Repeat work cycles to verify villager XP/level/perk progression.

Expected:

- `scrap_pile` can produce `parts` and bonus `gear`/`blueprint_shard` per config.
- Stamina limits enforced.

---

## 8) Quests + Sidebar Data Consistency

- [ ] Sidebar villager count matches actual board villagers.
- [ ] Sidebar completed-today count matches real task completions.
- [ ] Success checklist reflects quest progression dynamically.
- [ ] Quest API (`/api/quests/state`) reflects daily/weekly/monthly/seasonal progress.

Expected:

- No hardcoded or stale sidebar values after refresh.

---

## 9) Blueprints + Plugins + Integrations

- [ ] Create blueprint in `/tasks#blueprints`, verify list persistence.
- [ ] Spawn blueprint card to board and verify payload fields.
- [ ] Open `/tasks#plugins`, register sample manifest, install plugin (cost applied), spawn plugin card to board.
- [ ] Calendar integration path:
  - [ ] Export task via `/tasks` Calendar button.
  - [ ] Export task via board modal `Calendar (.ics)` button.
  - [ ] Validate `.ics` includes title, due date, recurrence RRULE when set.

Expected:

- Plugin registration does not require server restart.

---

## 10) Persistence + Restart

- [ ] Restart server, reload `/tasks` and `/board`.
- [ ] Verify tasks, board stacks, loot, profile/team, plugins, and blueprints still intact.
- [ ] Verify auth sessions behave per TTL and logout clears access.

Expected:

- No regression in file-backed persistence across restart.

## Known Automation Gap: Full Browser E2E

Current automation strongly covers backend logic and API integration, but does not yet drive browser drag/drop directly.

To automate full UI behaviors (drag cards, stack visuals, modal roundtrips), add browser E2E (Playwright recommended):

1. OTP login + onboarding flow automation.
2. Drag/drop card interactions on `/board`.
3. Assert card/task parity between `/board` and `/tasks`.
4. Screenshot diff checks for key board states.

Recommended next step:

1. Add Playwright as dev dependency.
2. Add `e2e/board.spec.ts` and `e2e/tasks.spec.ts`.
3. Add `task e2e` and include in `qa_gate.sh` when CI browser runtime is available.

## Defect Triage Rules During UAT

Treat as P0 immediately:

1. Auth bypass.
2. Data loss/corruption across refresh/restart.
3. Task/board desync that changes user-visible truth.
4. Board freeze or inability to drag core cards.

## UAT Evidence Template

For each failed case capture:

1. Case ID / section.
2. Exact steps and timestamp.
3. Expected vs actual result.
4. Screenshot or video.
5. Relevant console/network error and `X-Request-Id` if API involved.

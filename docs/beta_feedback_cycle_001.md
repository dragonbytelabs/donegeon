# Closed Beta Feedback Cycle 001

Date: 2026-02-07

## Scope

Target cohort: early internal playtest users focused on `/board` and `/tasks` flows.

## Collected Feedback

1. `/tasks` list had a "Process" action that confused progression semantics.
2. Marking a task done in `/tasks` did not always remove the live board stack.
3. Done->pending transitions risked losing task details in user perception.
4. Tasks edited from `/board` were not consistently visible under "Live only (board tasks)".

## Incorporated Changes

Implemented in this cycle:

- Removed `Process` action from `/tasks` rows (board remains primary interaction loop).
- Added board command `task.complete_by_task_id` and routed live task completion through board authority.
- Strengthened live-task consistency by re-marking linked tasks live on board-side title/description save.
- Added regression tests for:
  - done flow removing board-live stacks,
  - board save preserving live visibility,
  - done toggle preserving task detail fields.

## Config/Rule Impact

Gameplay rule alignment (no user-facing feature dilution):

- Completion semantics remain villager-gated and board-authoritative.
- Live-task filtering now reflects board-linked task state after board-side edits.

## Exit Criteria Status

- [x] At least one feedback cycle incorporated into rules/behavior.
- [ ] No P0 auth/data-loss defects open (tracked in launch checklist sign-off).


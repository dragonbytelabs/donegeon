# Decks
This document lists all deck types, their purpose, example contents, and how they unlock.

## Decks (5)

1. First Day Deck (ID: `deck_first_day`)
- Cost: 0 (free)
- Status: unlocked at seed
- Purpose: Bootstrap new players with starting tasks / small rewards
- Typical contents:
  - blank_task (30%)
  - coin loot (25%)
  - paper loot (15%)
  - resources (berry_bush) (15%)
  - modifier: `next_action` (10%)
  - modifier: `checklist` (5%)
- Notes: Limited free opens recommended (config `FirstDayFreeOpenLimit`).

2. Organization Deck (ID: `deck_organization`)
- Cost: 2
- Purpose: Workflow modifiers to structure work
- Unlock: configurable by tasks processed (default 10 tasks)
- Typical contents:
  - modifier: `next_action` (25%)
  - modifier: `review_cadence` (25%)
  - modifier: `checklist` (20%)
  - modifier: `recurring_contract` (15%)
  - modifier: `importance_seal` (10%)
  - blank_task (5%)

3. Maintenance Deck (ID: `deck_maintenance`)
- Cost: 3
- Purpose: Upkeep and blocker handling
- Unlock: configurable by tasks processed (default 25 tasks)
- Typical contents:
  - modifier: `recurring_contract` (30%)
  - modifier: `waiting_on` (25%)
  - modifier: `review_cadence` (20%)
  - modifier: `deadline_pin` (15%)
  - loot/gear (5%)
  - blank_task (5%)

4. Planning Deck (ID: `deck_planning`)
- Cost: 4
- Purpose: Project planning, breaking down work
- Unlock: configurable by tasks processed (default 50 tasks)
- Typical contents:
  - modifier: `next_action` (30%)
  - modifier: `checklist` (25%)
  - modifier: `schedule_token` (20%)
  - loot: blueprint shard / paper (25%)

5. Integration Deck (ID: `deck_integration`)
- Cost: 6
- Purpose: Advanced materials and high-tier rewards
- Unlock: configurable by tasks processed (default 100 tasks)
- Typical contents:
  - loot: parts, blueprint shards, gear
  - rare modifiers


## Unlock rules
Unlocks are driven by play milestones. Defaults are set in the balance config and can be tuned:
- Organization: `DeckUnlockOrganizationTasks` (default 10 tasks processed)
- Maintenance: `DeckUnlockMaintenanceTasks` (default 25)
- Planning: `DeckUnlockPlanningTasks` (default 50)
- Integration: `DeckUnlockIntegrationTasks` (default 100)

Deck unlocks are applied by the engine when the global `World.TasksProcessed` counter meets or exceeds the threshold.
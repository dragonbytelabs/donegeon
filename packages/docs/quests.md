# Donegeon v0.1 — Year-One Quest System (Single Source of Truth)

> Purpose  
> Define the full quest arc for the first in-game year:
> - What a “quest” is
> - How many exist
> - How they scale from Day 1 → Day 365
> - Seasonal structure
> - Boss quests
> - Rewards, drops, and progression unlocks
>
> This document intentionally avoids UI and focuses on **game + task logic**.

---

## 1. Core Concepts (Locked Definitions)

### 1.1 What is a Quest?
A **Quest** is a *structured objective* that:
- References **tasks**, **cards**, **zones**, or **time**
- Has **clear success conditions**
- Grants **rewards** (resources, cards, unlocks)
- May introduce **new mechanics**

Quests DO NOT:
- Replace tasks
- Micromanage user behavior
- Require specific real-world task content

Quests are **meta-objectives layered on top of tasks**.

---

### 1.2 Quest Types

| Type | Description |
|----|----|
| **Daily Quests** | Lightweight guidance; always present |
| **Story Quests** | One-time, narrative, unlock mechanics |
| **Seasonal Quests** | Thematic arcs (quarters) |
| **Boss Quests** | High-stakes system tests |
| **Failure Quests** | Triggered by neglect (zombies, debt, backlog) |

---

## 2. Year-One Structure (Macro View)

### Total Duration
- **365 in-game days**
- One *real* calendar year
- The game expects daily engagement but tolerates skips

### Quest Volume
- **365 Daily Quests** (soft guidance)
- **48 Story Quests** (roughly weekly)
- **4 Seasonal Arcs**
- **8 Boss Quests**
- **∞ Failure Quests** (dynamic)

> The player will *never* see all quests at once.

---

## 3. Day 1 → Day 7 (The First Week)

### Day 1 — *“Awakening”* (First Quest Ever)

**Quest Type:** Story  
**Objective:**
- Create **1 task**
- Drag it onto the table

**Teaches:**
- Tasks become cards
- Cards can exist outside lists

**Rewards:**
- +50 Coins
- 1 Villager
- Unlock: *Inbox Deck*

---

### Day 2 — *“Time Has Weight”*
- Complete **1 task**
- Observe time passing

Reward:
- +1 Stamina Modifier
- Unlock: *Day Tick*

---

### Day 3 — *“Work Requires Workers”*
- Assign a Villager to a task

Reward:
- +1 Villager
- Unlock: *Villager fatigue*

---

### Day 4 — *“Neglect Has Consequences”*
- Leave a task incomplete overnight

Effect:
- First **Zombie** spawns

Reward:
- +1 Weapon Modifier
- Unlock: *Zombie system*

---

### Day 5 — *“Cleaning Up Your Mess”*
- Defeat a Zombie

Reward:
- +100 Coins
- Unlock: *Graveyard Zone*

---

### Day 6 — *“Structure Emerges”*
- Create a **Project**
- Stack a task into a project

Reward:
- Project Card unlocked
- Unlock: *Project Zone*

---

### Day 7 — *Boss Quest 1: “The Backlog”*

**Trigger:** ≥5 tasks exist  
**Objective:**
- Reduce backlog to ≤2 tasks

**Failure Consequence:**
- 2 Zombies spawn

**Rewards:**
- +1 Recurring Contract
- Unlock: *Weekly Quests*

---

## 4. Daily Quests (Day 1 → Day 365)

Daily quests are **lightweight nudges**, not mandates.

Examples:
- “Complete any task”
- “Move one task into a project”
- “Prevent a zombie from spawning today”
- “Use a modifier”

Rules:
- Always optional
- Small rewards
- Stackable streak bonus

Rewards:
- Coins
- Small XP
- Occasionally a random card

---

## 5. Story Quests (Weeks 2–48)

### Frequency
- Roughly **1 per week**
- Always unlocks *something new*

### Examples
- “Recurring Work Exists” → unlock Recurring Contracts
- “Planning Ahead” → unlock Deadlines
- “Time is a Resource” → unlock Time Blocks
- “Automation Begins” → unlock Triggers (future Zapier)

---

## 6. Seasonal Arcs (Quarterly)

### Season 1 — **Spring: Foundation**
Days 1–90

Theme:
- Creation
- Learning
- Small mistakes

New Mechanics:
- Projects
- Recurrence
- Zombies
- Basic modifiers

Season Boss:
- **The Overgrowth** (backlog explosion)

---

### Season 2 — **Summer: Momentum**
Days 91–180

Theme:
- Speed
- Overcommitment
- Burnout

New Mechanics:
- Stamina limits
- Multi-villager tasks
- Time pressure

Season Boss:
- **The Burnout Hydra**

---

### Season 3 — **Autumn: Complexity**
Days 181–270

Theme:
- Systems
- Dependencies
- Planning

New Mechanics:
- Task dependencies
- Multi-step recipes
- Project chains

Season Boss:
- **The Entropy Engine**

---

### Season 4 — **Winter: Mastery**
Days 271–365

Theme:
- Sustainability
- Long-term thinking

New Mechanics:
- Automation buildings
- Calendar sync
- Passive income/resources

Final Boss:
- **The Eternal Backlog**

---

## 7. Boss Quests (8 Total)

Boss quests test **system mastery**, not task volume.

| Boss | Trigger | Tests |
|----|----|----|
| Backlog | Task overload | Cleanup |
| Burnout Hydra | Overwork | Balance |
| Entropy Engine | Too many dependencies | Planning |
| Eternal Backlog | Year end | Sustainability |

Boss Rewards:
- Permanent unlocks
- Rare modifiers
- Buildings
- Cosmetic prestige

---

## 8. Failure Quests (Dynamic)

Triggered by:
- Ignoring tasks
- Missing deadlines
- Too many zombies
- No villagers available

Examples:
- “The Dead Rise” → clear 3 zombies
- “System Collapse” → restore order

Failure quests are:
- Never optional
- Time-sensitive
- Punitive but recoverable

---

## 9. Rewards & Drops

### Resource Types
- Coins
- XP
- Time
- Villagers
- Modifiers
- Buildings

### Card Drops
- Task Cards (blank)
- Modifier Cards
- Villager Cards
- Project Cards

### Progression Locks
- Decks
- Zones
- Automation
- Integrations (Calendar, Zapier, etc.)

---

## 10. Design Principles (Non-Negotiable)

- Tasks are **user-defined**, not game-defined
- The game **never dictates real-world content**
- Failure is recoverable, not terminal
- The board is a *representation*, not the source of truth
- Backend rules drive everything

---

## 1) Data Schema (JSON Schema–style)

> Notes
> - Quests are **meta-objectives** that reference user-defined tasks/cards/zones.
> - The “daily quest” system is represented as **generators** (templates) rather than 365 explicit objects.
> - All rewards/drops should be evaluated server-side.

### 1.1 Root

```json
{
  "version": "0.1",
  "calendar": {
    "days": 365,
    "weeks": 52,
    "weekStart": "monday",
    "seasonBoundaries": [
      { "seasonId": "spring", "dayStart": 1, "dayEnd": 90 },
      { "seasonId": "summer", "dayStart": 91, "dayEnd": 180 },
      { "seasonId": "autumn", "dayStart": 181, "dayEnd": 270 },
      { "seasonId": "winter", "dayStart": 271, "dayEnd": 365 }
    ]
  },
  "rewardTables": [],
  "generators": [],
  "quests": [],
  "weekPlan": []
}
1.2 Quest object
json
Copy code
{
  "$id": "Quest",
  "type": "object",
  "required": ["id", "title", "type", "scope", "trigger", "objectives", "rewards"],
  "properties": {
    "id": { "type": "string" },
    "title": { "type": "string" },

    "type": {
      "type": "string",
      "enum": ["daily", "story", "seasonal", "boss", "failure"]
    },

    "scope": {
      "type": "string",
      "enum": ["day", "week", "season", "year", "dynamic"]
    },

    "seasonId": {
      "type": "string",
      "enum": ["spring", "summer", "autumn", "winter"],
      "nullable": true
    },

    "difficulty": {
      "type": "string",
      "enum": ["intro", "easy", "medium", "hard"],
      "default": "easy"
    },

    "trigger": {
      "$ref": "Trigger"
    },

    "objectives": {
      "type": "array",
      "items": { "$ref": "Objective" },
      "minItems": 1
    },

    "failure": {
      "type": "object",
      "properties": {
        "consequences": {
          "type": "array",
          "items": { "$ref": "Consequence" }
        }
      },
      "default": { "consequences": [] }
    },

    "rewards": {
      "type": "array",
      "items": { "$ref": "Reward" },
      "default": []
    },

    "unlocks": {
      "type": "array",
      "items": { "$ref": "Unlock" },
      "default": []
    },

    "notes": { "type": "string", "default": "" }
  }
}
1.3 Trigger
json
Copy code
{
  "$id": "Trigger",
  "type": "object",
  "required": ["kind"],
  "properties": {
    "kind": {
      "type": "string",
      "enum": ["on_day", "on_week", "on_season_start", "on_season_end", "on_event", "condition"]
    },
    "day": { "type": "integer", "minimum": 1, "maximum": 365 },
    "week": { "type": "integer", "minimum": 1, "maximum": 52 },

    "event": {
      "type": "string",
      "enum": [
        "task_created",
        "task_completed",
        "inbox_processed",
        "project_created",
        "modifier_attached",
        "villager_assigned",
        "zombie_spawned",
        "zombie_cleared",
        "deck_opened",
        "building_built",
        "overrun_entered",
        "overrun_recovered"
      ]
    },

    "condition": {
      "$ref": "Condition"
    }
  }
}
1.4 Objectives
json
Copy code
{
  "$id": "Objective",
  "type": "object",
  "required": ["op"],
  "properties": {
    "op": {
      "type": "string",
      "enum": [
        "create_task",
        "complete_task",
        "move_task_to_project",
        "assign_villager",
        "open_deck",
        "attach_modifier",
        "clear_zombie",
        "build_building",
        "reduce_backlog_to",
        "keep_zombies_below",
        "schedule_task",
        "process_inbox_count"
      ]
    },

    "count": { "type": "integer", "minimum": 1 },

    "taskFilter": { "$ref": "TaskFilter" },

    "value": { "type": "integer" },

    "ref": { "type": "string" },

    "timeWindow": {
      "type": "string",
      "enum": ["today", "this_week", "this_season", "rolling_7d"],
      "default": "today"
    }
  }
}
1.5 TaskFilter
json
Copy code
{
  "$id": "TaskFilter",
  "type": "object",
  "properties": {
    "projectId": { "type": "string" },
    "isInbox": { "type": "boolean" },
    "hasDeadline": { "type": "boolean" },
    "isRecurring": { "type": "boolean" },
    "duration": { "type": "string", "enum": ["quick", "medium", "long"] },
    "importance": { "type": "string", "enum": ["normal", "important"] },
    "inferredType": {
      "type": "string",
      "enum": ["admin", "maintenance", "planning", "deep_work", "perpetual_flow"]
    }
  }
}
1.6 Rewards, Unlocks, Consequences
json
Copy code
{
  "$id": "Reward",
  "type": "object",
  "required": ["kind"],
  "properties": {
    "kind": { "type": "string", "enum": ["currency", "card", "roll_table", "xp", "cosmetic"] },
    "currency": { "type": "string", "enum": ["coin"] },
    "amount": { "type": "integer", "minimum": 1 },

    "card": { "$ref": "CardGrant" },

    "tableId": { "type": "string" },

    "xp": { "type": "integer", "minimum": 1 }
  }
}
json
Copy code
{
  "$id": "CardGrant",
  "type": "object",
  "required": ["cardType"],
  "properties": {
    "cardType": {
      "type": "string",
      "enum": [
        "blank_task",
        "villager",
        "recurring_contract",
        "deadline_pin",
        "schedule_token",
        "importance_seal",
        "cleanup_tool",
        "coin_card",
        "paper_card",
        "ink_card",
        "gear_card",
        "parts_card",
        "integration_core_part",
        "blueprint_shard"
      ]
    },
    "charges": { "type": "integer", "minimum": 0, "nullable": true },
    "count": { "type": "integer", "minimum": 1, "default": 1 }
  }
}
json
Copy code
{
  "$id": "Unlock",
  "type": "object",
  "required": ["kind", "id"],
  "properties": {
    "kind": { "type": "string", "enum": ["deck", "zone", "building", "system_feature"] },
    "id": { "type": "string" }
  }
}
json
Copy code
{
  "$id": "Consequence",
  "type": "object",
  "required": ["kind"],
  "properties": {
    "kind": {
      "type": "string",
      "enum": [
        "spawn_zombie",
        "increase_pack_cost",
        "reduce_loot_multiplier",
        "apply_villager_tired",
        "disable_blueprint_drops_temporarily"
      ]
    },
    "amount": { "type": "integer", "minimum": 1, "nullable": true },
    "durationDays": { "type": "integer", "minimum": 1, "nullable": true }
  }
}
1.7 Daily Quest Generators (templates)
json
Copy code
{
  "$id": "Generator",
  "type": "object",
  "required": ["id", "kind", "pool", "rules"],
  "properties": {
    "id": { "type": "string" },
    "kind": { "type": "string", "enum": ["daily_pool", "failure_pool"] },

    "pool": {
      "type": "array",
      "items": { "$ref": "Quest" }
    },

    "rules": {
      "type": "object",
      "properties": {
        "drawCount": { "type": "integer", "minimum": 1 },
        "noRepeatDays": { "type": "integer", "minimum": 0, "default": 2 },
        "seasonWeights": {
          "type": "object",
          "additionalProperties": { "type": "number" }
        }
      }
    }
  }
}
2) Reward Tables (Drop/Award System)
These are referenced by quests via Reward(kind="roll_table", tableId=...).

json
Copy code
{
  "rewardTables": [
    {
      "id": "daily_small",
      "rolls": 1,
      "entries": [
        { "weight": 40, "reward": { "kind": "currency", "currency": "coin", "amount": 10 } },
        { "weight": 20, "reward": { "kind": "card", "card": { "cardType": "paper_card", "count": 1 } } },
        { "weight": 20, "reward": { "kind": "card", "card": { "cardType": "ink_card", "count": 1 } } },
        { "weight": 15, "reward": { "kind": "card", "card": { "cardType": "coin_card", "count": 1 } } },
        { "weight": 5,  "reward": { "kind": "card", "card": { "cardType": "blank_task", "count": 1 } } }
      ]
    },
    {
      "id": "weekly_story",
      "rolls": 1,
      "entries": [
        { "weight": 30, "reward": { "kind": "currency", "currency": "coin", "amount": 50 } },
        { "weight": 20, "reward": { "kind": "card", "card": { "cardType": "recurring_contract", "charges": 4, "count": 1 } } },
        { "weight": 15, "reward": { "kind": "card", "card": { "cardType": "deadline_pin", "count": 1 } } },
        { "weight": 15, "reward": { "kind": "card", "card": { "cardType": "schedule_token", "charges": 2, "count": 1 } } },
        { "weight": 10, "reward": { "kind": "card", "card": { "cardType": "villager", "count": 1 } } },
        { "weight": 10, "reward": { "kind": "card", "card": { "cardType": "blueprint_shard", "count": 1 } } }
      ]
    },
    {
      "id": "boss_big",
      "rolls": 2,
      "entries": [
        { "weight": 35, "reward": { "kind": "currency", "currency": "coin", "amount": 150 } },
        { "weight": 20, "reward": { "kind": "card", "card": { "cardType": "villager", "count": 1 } } },
        { "weight": 20, "reward": { "kind": "card", "card": { "cardType": "blueprint_shard", "count": 2 } } },
        { "weight": 15, "reward": { "kind": "card", "card": { "cardType": "recurring_contract", "charges": 4, "count": 2 } } },
        { "weight": 10, "reward": { "kind": "card", "card": { "cardType": "integration_core_part", "count": 1 } } }
      ]
    }
  ]
}
3) Week-by-Week Quest Table (52 Weeks)
Format: one row per week, each containing:

Season

Weekly Story Quest (machine-spec)

Weekly “Boss” (some weeks)

Unlock focus

Reward table reference

Daily quests come from generators, so the week plan doesn’t list 7×52 items.

3.1 Conventions
Weeks 1–13: Spring (Foundation)

Weeks 14–26: Summer (Momentum)

Weeks 27–39: Autumn (Complexity)

Weeks 40–52: Winter (Mastery)

Boss cadence (v0.1):

Boss at end of each month-ish: Weeks 1, 4, 8, 13, 17, 26, 39, 52 (8 total)

3.2 Table
yaml
Copy code
weekPlan:
  - week: 1
    seasonId: spring
    storyQuest:
      id: W01_Awakening
      title: "Awakening"
      type: story
      scope: week
      trigger: { kind: on_week, week: 1 }
      objectives:
        - { op: create_task, count: 1, timeWindow: this_week }
        - { op: open_deck, count: 1, ref: deck_first_day, timeWindow: this_week }
        - { op: assign_villager, count: 1, timeWindow: this_week }
      rewards:
        - { kind: roll_table, tableId: weekly_story }
      unlocks:
        - { kind: deck, id: deck_first_day }
        - { kind: system_feature, id: "board_view" }
    bossQuest:
      id: B01_BacklogSeed
      title: "Boss: The Backlog Seed"
      type: boss
      scope: week
      trigger: { kind: on_week, week: 1 }
      objectives:
        - { op: complete_task, count: 3, timeWindow: this_week }
      failure:
        consequences:
          - { kind: spawn_zombie, amount: 1 }
      rewards:
        - { kind: roll_table, tableId: boss_big }
    focus: [inbox_capture, villagers_basics, first_day_deck]
    rewardTable: weekly_story

  - week: 2
    seasonId: spring
    storyQuest:
      id: W02_InboxToProject
      title: "Inbox to Project"
      type: story
      scope: week
      trigger: { kind: on_week, week: 2 }
      objectives:
        - { op: process_inbox_count, count: 5, timeWindow: this_week }
        - { op: move_task_to_project, count: 3, timeWindow: this_week }
      rewards:
        - { kind: roll_table, tableId: weekly_story }
      unlocks:
        - { kind: system_feature, id: "projects" }
    focus: [projects, processing]
    rewardTable: weekly_story

  - week: 3
    seasonId: spring
    storyQuest:
      id: W03_ModifiersAppear
      title: "Modifiers Appear"
      type: story
      scope: week
      trigger: { kind: on_week, week: 3 }
      objectives:
        - { op: open_deck, count: 2, ref: deck_first_day, timeWindow: this_week }
        - { op: attach_modifier, count: 1, timeWindow: this_week }
      rewards:
        - { kind: roll_table, tableId: weekly_story }
      unlocks:
        - { kind: deck, id: deck_organization }
    focus: [modifiers, deck_unlocks]
    rewardTable: weekly_story

  - week: 4
    seasonId: spring
    storyQuest:
      id: W04_RecurringBasics
      title: "Recurring Basics"
      type: story
      scope: week
      trigger: { kind: on_week, week: 4 }
      objectives:
        - { op: attach_modifier, count: 1, ref: "recurring_contract", timeWindow: this_week }
        - { op: complete_task, count: 5, timeWindow: this_week }
      rewards:
        - { kind: roll_table, tableId: weekly_story }
    bossQuest:
      id: B02_FirstCleanup
      title: "Boss: First Cleanup"
      type: boss
      scope: week
      trigger: { kind: on_week, week: 4 }
      objectives:
        - { op: keep_zombies_below, value: 1, timeWindow: this_week }
      failure:
        consequences:
          - { kind: spawn_zombie, amount: 1 }
      rewards:
        - { kind: roll_table, tableId: boss_big }
    focus: [recurrence_charges, cozy_pressure]
    rewardTable: weekly_story

  # --- Weeks 5–13 (Spring: Foundation) ---
  - week: 5
    seasonId: spring
    storyQuest: { id: W05_Deadlines, title: "Deadlines", type: story, scope: week,
      trigger: { kind: on_week, week: 5 },
      objectives:
        - { op: attach_modifier, count: 1, ref: "deadline_pin", timeWindow: this_week }
        - { op: complete_task, count: 5, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }],
      unlocks: [{ kind: system_feature, id: "due_dates" }]
    }
    focus: [deadlines, zombie_spawn_single]
    rewardTable: weekly_story

  - week: 6
    seasonId: spring
    storyQuest: { id: W06_ProjectIdentity, title: "Project Identity", type: story, scope: week,
      trigger: { kind: on_week, week: 6 },
      objectives:
        - { op: move_task_to_project, count: 5, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }],
      unlocks: [{ kind: building, id: "project_board" }]
    }
    focus: [project_board_building]
    rewardTable: weekly_story

  - week: 7
    seasonId: spring
    storyQuest: { id: W07_ZombieDiscipline, title: "Zombie Discipline", type: story, scope: week,
      trigger: { kind: on_week, week: 7 },
      objectives:
        - { op: clear_zombie, count: 1, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [single_zombie_loop]
    rewardTable: weekly_story

  - week: 8
    seasonId: spring
    storyQuest: { id: W08_StaminaMatters, title: "Stamina Matters", type: story, scope: week,
      trigger: { kind: on_week, week: 8 },
      objectives:
        - { op: complete_task, count: 8, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }],
      unlocks: [{ kind: building, id: "rest_hall" }]
    }
    bossQuest:
      id: B03_StaminaCheck
      title: "Boss: Stamina Check"
      type: boss
      scope: week
      trigger: { kind: on_week, week: 8 }
      objectives:
        - { op: complete_task, count: 10, timeWindow: this_week }
      failure:
        consequences:
          - { kind: apply_villager_tired, amount: 1, durationDays: 2 }
      rewards:
        - { kind: roll_table, tableId: boss_big }
    focus: [rest_hall, capacity]
    rewardTable: weekly_story

  - week: 9
    seasonId: spring
    storyQuest: { id: W09_DeckChoice, title: "Deck Choice", type: story, scope: week,
      trigger: { kind: on_week, week: 9 },
      objectives:
        - { op: open_deck, count: 2, ref: deck_organization, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [deck_gating, coins_to_packs]
    rewardTable: weekly_story

  - week: 10
    seasonId: spring
    storyQuest: { id: W10_FirstBlueprintShard, title: "First Blueprint Shard", type: story, scope: week,
      trigger: { kind: on_week, week: 10 },
      objectives:
        - { op: complete_task, count: 2, taskFilter: { inferredType: planning }, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [planning_drops, blueprint_shards]
    rewardTable: weekly_story

  - week: 11
    seasonId: spring
    storyQuest: { id: W11_RecurringCharges, title: "Recurring Charges", type: story, scope: week,
      trigger: { kind: on_week, week: 11 },
      objectives:
        - { op: complete_task, count: 1, taskFilter: { isRecurring: true }, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [charges_decrement, spent_salvage]
    rewardTable: weekly_story

  - week: 12
    seasonId: spring
    storyQuest: { id: W12_PreBossPrep, title: "Pre-Boss Prep", type: story, scope: week,
      trigger: { kind: on_week, week: 12 },
      objectives:
        - { op: reduce_backlog_to, value: 5, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [backlog_management]
    rewardTable: weekly_story

  - week: 13
    seasonId: spring
    storyQuest: { id: W13_SpringFinale, title: "Spring Finale", type: seasonal, scope: week,
      trigger: { kind: on_week, week: 13 },
      objectives:
        - { op: complete_task, count: 12, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }],
      unlocks: [{ kind: deck, id: deck_maintenance }]
    }
    bossQuest:
      id: B04_Overgrowth
      title: "Season Boss: The Overgrowth"
      type: boss
      scope: week
      trigger: { kind: on_week, week: 13 }
      objectives:
        - { op: keep_zombies_below, value: 2, timeWindow: this_week }
        - { op: reduce_backlog_to, value: 3, timeWindow: this_week }
      failure:
        consequences:
          - { kind: spawn_zombie, amount: 2 }
          - { kind: increase_pack_cost, amount: 1, durationDays: 7 }
      rewards:
        - { kind: roll_table, tableId: boss_big }
    focus: [season_unlock, maintenance_deck]
    rewardTable: weekly_story

  # --- Weeks 14–26 (Summer: Momentum) ---
  - week: 14
    seasonId: summer
    storyQuest: { id: W14_SummerKickoff, title: "Summer Kickoff: Momentum", type: seasonal, scope: week,
      trigger: { kind: on_week, week: 14 },
      objectives:
        - { op: complete_task, count: 10, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [momentum, more_tasks]
    rewardTable: weekly_story

  - week: 15
    seasonId: summer
    storyQuest: { id: W15_MaintenanceStability, title: "Maintenance = Stability", type: story, scope: week,
      trigger: { kind: on_week, week: 15 },
      objectives:
        - { op: complete_task, count: 3, taskFilter: { inferredType: maintenance }, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [gear_economy, maintenance_pressure]
    rewardTable: weekly_story

  - week: 16
    seasonId: summer
    storyQuest: { id: W16_Consistency, title: "Consistency", type: story, scope: week,
      trigger: { kind: on_week, week: 16 },
      objectives:
        - { op: complete_task, count: 1, timeWindow: rolling_7d },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [streaks_soft]
    rewardTable: weekly_story

  - week: 17
    seasonId: summer
    storyQuest: { id: W17_WorkloadControl, title: "Workload Control", type: story, scope: week,
      trigger: { kind: on_week, week: 17 },
      objectives:
        - { op: reduce_backlog_to, value: 7, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    bossQuest:
      id: B05_BurnoutHydra
      title: "Boss: The Burnout Hydra"
      type: boss
      scope: week
      trigger: { kind: on_week, week: 17 }
      objectives:
        - { op: complete_task, count: 12, timeWindow: this_week }
        - { op: keep_zombies_below, value: 2, timeWindow: this_week }
      failure:
        consequences:
          - { kind: apply_villager_tired, amount: 1, durationDays: 3 }
      rewards:
        - { kind: roll_table, tableId: boss_big }
    focus: [avoid_overrun, pacing]
    rewardTable: weekly_story

  - week: 18
    seasonId: summer
    storyQuest: { id: W18_PartsFromDeepWork, title: "Parts From Deep Work", type: story, scope: week,
      trigger: { kind: on_week, week: 18 },
      objectives:
        - { op: complete_task, count: 2, taskFilter: { inferredType: deep_work }, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }],
      unlocks: [{ kind: deck, id: deck_planning_progress }]
    }
    focus: [deep_work_rewards, progress_deck]
    rewardTable: weekly_story

  - week: 19
    seasonId: summer
    storyQuest: { id: W19_TemplatesMatter, title: "Templates Matter", type: story, scope: week,
      trigger: { kind: on_week, week: 19 },
      objectives:
        - { op: open_deck, count: 2, ref: deck_planning_progress, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [templates, structure]
    rewardTable: weekly_story

  - week: 20
    seasonId: summer
    storyQuest: { id: W20_FirstBlueprint, title: "First Blueprint", type: story, scope: week,
      trigger: { kind: on_week, week: 20 },
      objectives:
        - { op: complete_task, count: 3, taskFilter: { inferredType: planning }, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [blueprint_shards_to_blueprint]
    rewardTable: weekly_story

  - week: 21
    seasonId: summer
    storyQuest: { id: W21_ScheduleToken, title: "Schedule Token", type: story, scope: week,
      trigger: { kind: on_week, week: 21 },
      objectives:
        - { op: attach_modifier, count: 1, ref: "schedule_token", timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [scheduling_pre_calendar]
    rewardTable: weekly_story

  - week: 22
    seasonId: summer
    storyQuest: { id: W22_MultiProjectWeek, title: "Multi-Project Week", type: story, scope: week,
      trigger: { kind: on_week, week: 22 },
      objectives:
        - { op: move_task_to_project, count: 5, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [projects_scale]
    rewardTable: weekly_story

  - week: 23
    seasonId: summer
    storyQuest: { id: W23_ZombiePrevention, title: "Zombie Prevention", type: story, scope: week,
      trigger: { kind: on_week, week: 23 },
      objectives:
        - { op: keep_zombies_below, value: 1, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [discipline]
    rewardTable: weekly_story

  - week: 24
    seasonId: summer
    storyQuest: { id: W24_ResourceFlow, title: "Resource Flow", type: story, scope: week,
      trigger: { kind: on_week, week: 24 },
      objectives:
        - { op: open_deck, count: 3, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [coins_packs_loop]
    rewardTable: weekly_story

  - week: 25
    seasonId: summer
    storyQuest: { id: W25_PreFinale, title: "Pre-Finale: Stabilize", type: story, scope: week,
      trigger: { kind: on_week, week: 25 },
      objectives:
        - { op: reduce_backlog_to, value: 5, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [stability]
    rewardTable: weekly_story

  - week: 26
    seasonId: summer
    storyQuest: { id: W26_SummerFinale, title: "Summer Finale: Momentum Bank", type: seasonal, scope: week,
      trigger: { kind: on_week, week: 26 },
      objectives:
        - { op: complete_task, count: 15, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }],
      unlocks: [{ kind: building, id: "routine_farm" }]
    }
    bossQuest:
      id: B06_MomentumBoss
      title: "Season Boss: Momentum Bank"
      type: boss
      scope: week
      trigger: { kind: on_week, week: 26 }
      objectives:
        - { op: keep_zombies_below, value: 2, timeWindow: this_week }
        - { op: complete_task, count: 15, timeWindow: this_week }
      failure:
        consequences:
          - { kind: spawn_zombie, amount: 2 }
      rewards:
        - { kind: roll_table, tableId: boss_big }
    focus: [routine_farm_unlock]
    rewardTable: weekly_story

  # --- Weeks 27–39 (Autumn: Complexity) ---
  - week: 27
    seasonId: autumn
    storyQuest: { id: W27_AutumnKickoff, title: "Autumn Kickoff: Systems", type: seasonal, scope: week,
      trigger: { kind: on_week, week: 27 },
      objectives:
        - { op: build_building, count: 1, ref: "project_board", timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [systems]
    rewardTable: weekly_story

  - week: 28
    seasonId: autumn
    storyQuest: { id: W28_FarmFirst, title: "Farm First", type: story, scope: week,
      trigger: { kind: on_week, week: 28 },
      objectives:
        - { op: build_building, count: 1, ref: "routine_farm", timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [recurring_sustainability]
    rewardTable: weekly_story

  - week: 29
    seasonId: autumn
    storyQuest: { id: W29_BetterPlanning, title: "Better Planning", type: story, scope: week,
      trigger: { kind: on_week, week: 29 },
      objectives:
        - { op: complete_task, count: 3, taskFilter: { inferredType: planning }, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [planning_as_leverage]
    rewardTable: weekly_story

  - week: 30
    seasonId: autumn
    storyQuest: { id: W30_DeckMastery, title: "Deck Mastery", type: story, scope: week,
      trigger: { kind: on_week, week: 30 },
      objectives:
        - { op: open_deck, count: 2, ref: deck_planning_progress, timeWindow: this_week },
        - { op: open_deck, count: 2, ref: deck_maintenance, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [multi_deck_economy]
    rewardTable: weekly_story

  - week: 31
    seasonId: autumn
    storyQuest: { id: W31_PreIntegration, title: "Pre-Integration", type: story, scope: week,
      trigger: { kind: on_week, week: 31 },
      objectives:
        - { op: complete_task, count: 2, taskFilter: { inferredType: deep_work }, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [integration_parts_pre]
    rewardTable: weekly_story

  - week: 32
    seasonId: autumn
    storyQuest: { id: W32_WorkshopGate, title: "Workshop Gate", type: story, scope: week,
      trigger: { kind: on_week, week: 32 },
      objectives:
        - { op: open_deck, count: 2, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }],
      unlocks: [{ kind: deck, id: deck_integration }]
    }
    focus: [integration_deck_unlock]
    rewardTable: weekly_story

  - week: 33
    seasonId: autumn
    storyQuest: { id: W33_IntegrationParts, title: "Integration Parts", type: story, scope: week,
      trigger: { kind: on_week, week: 33 },
      objectives:
        - { op: open_deck, count: 2, ref: deck_integration, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [integration_core_parts]
    rewardTable: weekly_story

  - week: 34
    seasonId: autumn
    storyQuest: { id: W34_CalendarPrep, title: "Calendar Prep", type: story, scope: week,
      trigger: { kind: on_week, week: 34 },
      objectives:
        - { op: attach_modifier, count: 2, ref: "schedule_token", timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [calendar_readiness]
    rewardTable: weekly_story

  - week: 35
    seasonId: autumn
    storyQuest: { id: W35_StabilityWeek, title: "Stability Week", type: story, scope: week,
      trigger: { kind: on_week, week: 35 },
      objectives:
        - { op: complete_task, count: 4, taskFilter: { inferredType: maintenance }, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [maintenance_stability]
    rewardTable: weekly_story

  - week: 36
    seasonId: autumn
    storyQuest: { id: W36_ZombieProofing, title: "Zombie Proofing", type: story, scope: week,
      trigger: { kind: on_week, week: 36 },
      objectives:
        - { op: keep_zombies_below, value: 1, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [pressure_management]
    rewardTable: weekly_story

  - week: 37
    seasonId: autumn
    storyQuest: { id: W37_DeepWorkPush, title: "Deep Work Push", type: story, scope: week,
      trigger: { kind: on_week, week: 37 },
      objectives:
        - { op: complete_task, count: 3, taskFilter: { inferredType: deep_work }, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [progress_acceleration]
    rewardTable: weekly_story

  - week: 38
    seasonId: autumn
    storyQuest: { id: W38_PreBoss, title: "Pre-Boss: Entropy Rising", type: story, scope: week,
      trigger: { kind: on_week, week: 38 },
      objectives:
        - { op: reduce_backlog_to, value: 6, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [entropy_control]
    rewardTable: weekly_story

  - week: 39
    seasonId: autumn
    storyQuest: { id: W39_AutumnFinale, title: "Autumn Finale: Complexity Tamed", type: seasonal, scope: week,
      trigger: { kind: on_week, week: 39 },
      objectives:
        - { op: build_building, count: 1, ref: "calendar_console", timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }],
      unlocks: [{ kind: system_feature, id: "calendar_integration" }]
    }
    bossQuest:
      id: B07_EntropyEngine
      title: "Season Boss: The Entropy Engine"
      type: boss
      scope: week
      trigger: { kind: on_week, week: 39 }
      objectives:
        - { op: schedule_task, count: 3, timeWindow: this_week }
        - { op: keep_zombies_below, value: 2, timeWindow: this_week }
      failure:
        consequences:
          - { kind: disable_blueprint_drops_temporarily, durationDays: 7 }
      rewards:
        - { kind: roll_table, tableId: boss_big }
    focus: [calendar_console_unlock]
    rewardTable: weekly_story

  # --- Weeks 40–52 (Winter: Mastery) ---
  - week: 40
    seasonId: winter
    storyQuest: { id: W40_WinterKickoff, title: "Winter Kickoff: Mastery", type: seasonal, scope: week,
      trigger: { kind: on_week, week: 40 },
      objectives:
        - { op: schedule_task, count: 5, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [planning_mastery]
    rewardTable: weekly_story

  - week: 41
    seasonId: winter
    storyQuest: { id: W41_CalendarFlow, title: "Calendar Flow", type: story, scope: week,
      trigger: { kind: on_week, week: 41 },
      objectives:
        - { op: complete_task, count: 10, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [calendar_benefits]
    rewardTable: weekly_story

  - week: 42
    seasonId: winter
    storyQuest: { id: W42_PrepAutomation, title: "Prep Automation", type: story, scope: week,
      trigger: { kind: on_week, week: 42 },
      objectives:
        - { op: open_deck, count: 3, ref: deck_integration, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [automation_materials]
    rewardTable: weekly_story

  - week: 43
    seasonId: winter
    storyQuest: { id: W43_AutomationFirstRule, title: "Automation: First Rule", type: story, scope: week,
      trigger: { kind: on_week, week: 43 },
      objectives:
        - { op: build_building, count: 1, ref: "automation_forge", timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }],
      unlocks: [{ kind: system_feature, id: "automations" }]
    }
    focus: [automation_forge]
    rewardTable: weekly_story

  - week: 44
    seasonId: winter
    storyQuest: { id: W44_AutomationUsage, title: "Automation Usage", type: story, scope: week,
      trigger: { kind: on_week, week: 44 },
      objectives:
        - { op: complete_task, count: 8, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [automation_effects]
    rewardTable: weekly_story

  - week: 45
    seasonId: winter
    storyQuest: { id: W45_Sustainability, title: "Sustainability", type: story, scope: week,
      trigger: { kind: on_week, week: 45 },
      objectives:
        - { op: keep_zombies_below, value: 1, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [steady_state]
    rewardTable: weekly_story

  - week: 46
    seasonId: winter
    storyQuest: { id: W46_YearlySystems, title: "Yearly Systems", type: story, scope: week,
      trigger: { kind: on_week, week: 46 },
      objectives:
        - { op: move_task_to_project, count: 5, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [projects_mature]
    rewardTable: weekly_story

  - week: 47
    seasonId: winter
    storyQuest: { id: W47_StreakSoft, title: "Soft Streak", type: story, scope: week,
      trigger: { kind: on_week, week: 47 },
      objectives:
        - { op: complete_task, count: 1, timeWindow: rolling_7d },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [cozy_streaks]
    rewardTable: weekly_story

  - week: 48
    seasonId: winter
    storyQuest: { id: W48_PreFinale, title: "Pre-Finale: Clean Slate", type: story, scope: week,
      trigger: { kind: on_week, week: 48 },
      objectives:
        - { op: reduce_backlog_to, value: 5, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [year_end_cleanup]
    rewardTable: weekly_story

  - week: 49
    seasonId: winter
    storyQuest: { id: W49_FarmAndAuto, title: "Farm + Automation", type: story, scope: week,
      trigger: { kind: on_week, week: 49 },
      objectives:
        - { op: complete_task, count: 10, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [late_game_flow]
    rewardTable: weekly_story

  - week: 50
    seasonId: winter
    storyQuest: { id: W50_ZombieZero, title: "Zombie Zero Week", type: story, scope: week,
      trigger: { kind: on_week, week: 50 },
      objectives:
        - { op: keep_zombies_below, value: 1, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [mastery_pressure]
    rewardTable: weekly_story

  - week: 51
    seasonId: winter
    storyQuest: { id: W51_FinalPrep, title: "Final Prep", type: story, scope: week,
      trigger: { kind: on_week, week: 51 },
      objectives:
        - { op: schedule_task, count: 5, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    focus: [final_boss_setup]
    rewardTable: weekly_story

  - week: 52
    seasonId: winter
    storyQuest: { id: W52_YearEnd, title: "Year End: The Eternal Backlog", type: seasonal, scope: week,
      trigger: { kind: on_week, week: 52 },
      objectives:
        - { op: reduce_backlog_to, value: 3, timeWindow: this_week },
        - { op: keep_zombies_below, value: 2, timeWindow: this_week },
      rewards: [{ kind: roll_table, tableId: weekly_story }]
    }
    bossQuest:
      id: B08_EternalBacklog
      title: "Final Boss: The Eternal Backlog"
      type: boss
      scope: week
      trigger: { kind: on_week, week: 52 }
      objectives:
        - { op: complete_task, count: 20, timeWindow: this_week }
        - { op: keep_zombies_below, value: 2, timeWindow: this_week }
      failure:
        consequences:
          - { kind: spawn_zombie, amount: 2 }
          - { kind: increase_pack_cost, amount: 1, durationDays: 7 }
      rewards:
        - { kind: roll_table, tableId: boss_big }
    focus: [completion, prestige]
    rewardTable: weekly_story
4) Daily Quest Generator Pool (Machine Form)
Use this instead of enumerating 365 quests.

yaml
Copy code
generators:
  - id: gen_daily_v01
    kind: daily_pool
    rules: { drawCount: 2, noRepeatDays: 2 }
    pool:
      - id: DQ_CompleteAny
        title: "Do Something"
        type: daily
        scope: day
        trigger: { kind: on_day, day: 0 } # (template)
        objectives: [ { op: complete_task, count: 1, timeWindow: today } ]
        rewards: [ { kind: roll_table, tableId: daily_small } ]

      - id: DQ_ProcessInbox
        title: "Process the Inbox"
        type: daily
        scope: day
        trigger: { kind: on_day, day: 0 }
        objectives: [ { op: process_inbox_count, count: 3, timeWindow: today } ]
        rewards: [ { kind: roll_table, tableId: daily_small } ]

      - id: DQ_AssignVillager
        title: "Put Someone to Work"
        type: daily
        scope: day
        trigger: { kind: on_day, day: 0 }
        objectives: [ { op: assign_villager, count: 1, timeWindow: today } ]
        rewards: [ { kind: roll_table, tableId: daily_small } ]

      - id: DQ_KeepZombiesLow
        title: "Keep the Dead Quiet"
        type: daily
        scope: day
        trigger: { kind: on_day, day: 0 }
        objectives: [ { op: keep_zombies_below, value: 1, timeWindow: today } ]
        rewards: [ { kind: roll_table, tableId: daily_small } ]
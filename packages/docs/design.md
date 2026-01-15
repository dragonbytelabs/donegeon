DONEGEON

A Backend-First, Stacklands-Inspired Task System

Version: v0.1 implemented, v0.2 planned
Status: Actively playable
Canonical Design Document

1. What Is Donegeon?

Donegeon is a task manager that tells the truth about work.

It combines:

The clarity and API rigor of Todoist

The physical, emergent gameplay of Stacklands

A pressure system that reflects real-world neglect

A backend-driven simulation where time, effort, and prioritization matter

Donegeon is not a game layered on top of tasks.
It is a task system expressed as a game.

2. Core Design Principles
2.1 Backend Is Law

All rules live on the backend

Frontend renders state, never invents outcomes

Deck contents, drops, legality, recipes, penalties → server only

2.2 Real Life First, Game Second

Every mechanic maps to a real productivity concept:

Zombies = neglected work

Villagers = limited human energy

Modifiers = task metadata (due dates, recurrence, priority)

Decks = ways work enters your life

2.3 Time Is Scarce

Days advance

Stamina resets only on day ticks

Ignored tasks accumulate pressure

2.4 No Punishment Spirals

Zombies are capped

Recovery is always possible

Pressure nudges behavior, it doesn’t end the game

3. Mental Model (High-Level)
Tasks exist → tasks become cards → cards are stacked → 
backend validates → time advances → consequences occur


The board is a visualization, not the engine.

4. The Engine (How Donegeon Works)
4.1 Game State (Backend)

The backend maintains:

Current day

Global overrun level

Drawn task IDs

Active villagers

Active zombies

Card ownership and bindings

The frontend never computes:

What cards appear

Whether a stack is legal

What happens on a day tick

Whether a task spawns a zombie

5. Tasks (Todoist Parity)

Tasks are first-class backend entities.

5.1 Task Lifecycle
inbox → live → completed → archived

5.2 Implemented Task Features (v0.1)

Create / Update / Delete

Inbox processing

Completion

Projects (containers only)

Tags

Due dates

Recurrence

“Worked today” tracking

All task actions go through APIs.
No frontend mutation is allowed.

6. Cards

Cards are physical representations of backend entities.

6.1 Card Types
Card Type	Meaning
Task Card	A concrete task
Blank Task Card	A task waiting to be named
Modifier Card	Task metadata
Villager Card	Worker
Zombie Card	Penalty
Resource Card	Coins, salvage

Cards:

Do not own logic

May reference backend entities

Are validated server-side when stacked

7. Decks

Decks are controlled entry points for new work.

7.1 Deck Rules

Backend decides contents

Results are seeded + deterministic

Frontend can preview possibilities, not outcomes

7.2 Implemented Decks (v0.1)
Deck	Purpose
Inbox Deck	Entry point: blank tasks, villagers, basic modifiers
Organization Deck	Unlocks after 10 processed tasks
Explicit Non-Goals

No Project Decks

No user-defined decks

No frontend RNG

8. Modifiers

Modifiers represent real task-manager functionality.

8.1 Implemented Modifiers (v0.1)
Modifier	Real Meaning
Recurring Contract	Recurring task
Deadline Pin	Hard due date
Importance Seal	Priority
Schedule Token	Planned work
8.2 Modifier Rules

Attach only to Task Cards

Backend validates legality

Charges are consumed on day ticks

Spent modifiers can be salvaged

9. Planned Modifiers (v0.2)

Real-life helpers, not “gamey” buffs:

Next Action (global, only one allowed)

Focus Window

Energy Gate

Dependency Lock

Review Stamp

Context Filter

Effort Estimator

Calendar Anchor

Cooldown Token

Streak Seal

10. Villagers

Villagers represent limited human energy.

10.1 Villager Stats

Stamina

Max stamina

Speed

Level

Tired status

10.2 Villager Rules

Tasks consume stamina

Stamina resets only on day tick

Over-assignment is blocked

Leveling unlocks stat choices

11. Zombies

Zombies represent neglect, not failure.

11.1 Zombie Spawn Rules

Zombies spawn when:

Due dates are missed

Recurring tasks are ignored

Caps:

Max 5 zombies/day

11.2 Zombie Effects

Increase deck costs

Drain villager stamina

Increase pressure

11.3 Zombie Cleanup

Villager + Zombie

Consumes stamina + time

12. Time System
12.1 Day Tick

Triggered by:

End Day button

(Later) cron / automation

On tick:

Villager stamina resets

Recurrence charges consumed

Zombies spawn

Overrun level updates

13. Board View
13.1 Board Is a View

Positions are cosmetic

State persists on backend

Layout stored locally

13.2 Zones
Zone	Meaning
Inbox Pile	Unprocessed tasks
Live Pile	Active work
Graveyard	Completed / archived
13.3 Stacking Rules

Legal stacks:

Task + Modifier

Task + Villager

Illegal stacks:

Zombie on task

Modifier without task

14. Economy & Loot
14.1 Loot Types

Coins

Villagers

Modifiers

Blank Task Cards

14.2 Economy Rules

Coins drop from task completion

Deck costs scale with pressure

Salvage converts spent modifiers → resources

15. UX Decisions

Drag-first board

Snap-zone legality feedback

Recipe preview on hover

No blocking alerts

Canvas renderer optional (future)

16. Explicit v0.1 Non-Goals

Not implemented:

Mobile-first UX

Multiplayer

Automation chains

External integrations

Smart scheduling

Analytics dashboards

17. What Makes Donegeon Different

Tasks fight back if ignored

Time scarcity is explicit

Prioritization is physical

The system explains why you feel overwhelmed

18. Summary

Donegeon is:

A real task manager

A backend simulation

A physical mental model

A pressure-aware system

You don’t win Donegeon.
You stay ahead of it.
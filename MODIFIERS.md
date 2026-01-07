# Modifier System Redesign

## Real-World Modifiers (GTD-Inspired)

### ✅ Backend Complete

#### 1. **WaitingOn** ⏸️
- **Purpose**: Mark tasks blocked by external dependencies
- **Use Cases**: 
  - Waiting for someone's response
  - Waiting for delivery/approval
  - Blocked until a specific date
- **Fields**: 
  - `UnblockedAt` (time.Time) - when the blocker is resolved
- **Game Behavior** (TODO):
  - Task doesn't turn into zombie while waiting
  - Can't assign villager until unblocked
  - Auto-moves to ready state after UnblockedAt
  - Shows "Waiting On" badge with countdown

#### 2. **NextAction** ▶️
- **Purpose**: Mark the specific next physical action (GTD principle)
- **Use Cases**:
  - "Call John about project" vs vague "Handle project"
  - "Draft first paragraph" vs "Write report"
  - Clear, actionable next step
- **Fields**: None (just a flag)
- **Game Behavior** (TODO):
  - Priority in villager auto-assignment
  - 2x completion bonus
  - Shows "Next" badge
  - Tooltip explains GTD next action principle

#### 3. **ReviewCadence** 🔄
- **Purpose**: Recurring review tasks (weekly review, quarterly planning)
- **Use Cases**:
  - Weekly GTD review
  - Monthly budget check
  - Quarterly goal review
- **Fields**:
  - `ReviewEveryDays` (int) - review frequency
  - `ReviewNextAt` (time.Time) - next scheduled review
- **Game Behavior** (TODO):
  - Auto-returns to inbox after N days
  - No zombie penalty during grace period
  - Completion advances ReviewNextAt by N days
  - Shows "Review in X days" countdown

#### 4. **Checklist** ☑️
- **Purpose**: Break down complex tasks into steps
- **Use Cases**:
  - Multi-step projects
  - Recipes/procedures
  - Sequential workflows
- **Fields**:
  - `ChecklistTotal` (int) - total number of steps
  - `ChecklistCompleted` (int) - steps completed so far
- **Game Behavior** (TODO):
  - Progress bar shows X/Y steps
  - Zombie only if no progress in a day
  - Completion bonus scales with steps (more steps = more reward)
  - Can complete partial steps for partial credit

## Deck Rebalancing

### First Day Deck (Free)
- **Old**: 60% blank tasks, 33% loot (too generous)
- **New**: 30% tasks, 25% coins (reduced), 15% NextAction, 5% Checklist
- **Goal**: Still helpful but not infinite money exploit

### Organization Deck (2 coins)
- **Old**: Mix of game-y modifiers (Deadline, Schedule)
- **New**: Focus on GTD workflow (NextAction 25%, ReviewCadence 25%, Checklist 20%)
- **Goal**: Real task management tools

### Maintenance Deck (3 coins)
- **Old**: Recurring + Deadline heavy
- **New**: WaitingOn (25%), ReviewCadence (20%), Recurring (30%)
- **Goal**: Handling blockers and regular upkeep

### Planning Deck (4 coins)
- **Old**: Loot-heavy (blueprints, parts)
- **New**: NextAction (30%), Checklist (25%) for project planning
- **Goal**: Breaking down big goals

## TODO List

### ✅ Backend Implementation (COMPLETE)
- [x] Game engine logic for WaitingOn (block until date)
- [x] Game engine logic for NextAction (2x bonus on completion)
- [x] Game engine logic for ReviewCadence (skip zombie spawn if not due)
- [x] Game engine logic for Checklist (skip zombie if partial progress)
- [x] API endpoints for modifier-specific fields:
  - [x] POST /api/modifiers/waiting-on/set (set UnblockedAt)
  - [x] POST /api/modifiers/checklist/increment (increment completed)
  - [x] POST /api/modifiers/review/set (set ReviewEveryDays, ReviewNextAt)
- [x] Deck rebalancing with new modifiers
- [x] Validation for all new modifier types

### ✅ Frontend UI (COMPLETE)
- [x] Modifier badges on cards (⏸️ ▶️ 🔄 ☑️)
- [x] TypeScript types extended with new modifier fields
- [x] API methods for modifier updates
- [x] Modifier info display on cards:
  - [x] WaitingOn: Shows unblock date
  - [x] ReviewCadence: Shows review frequency
  - [x] Checklist: Shows progress (X/Y steps)
  - [x] NextAction: Shows "2x Bonus" indicator
- [x] Context menu actions:
  - [x] WaitingOn: Set Unblock Date
  - [x] Checklist: Complete Step with progress counter
  - [x] ReviewCadence: Set Review Schedule

### 🔄 Remaining Work
- [ ] Modal overlays for modifier configuration (currently using prompt())
- [ ] Modifier tooltips explaining GTD principles
- [ ] Detail panel sections for modifier-specific fields
- [ ] Visual indicators when WaitingOn is blocked
- [ ] Progress bar for checklist steps
- [ ] Auto-advance ReviewCadence on completion
- [ ] Quest integration:
  - [ ] Quest: "Use 5 Next Actions" → Unlock Planning Deck
  - [ ] Quest: "Complete 3 Checklists" → Unlock Organization Deck
  - [ ] Quest: "Set 10 Review Cadences" → Unlock Maintenance Deck

### Old Modifiers (Keep for Now)
- **RecurringContract**: Keep for repeating tasks
- **DeadlinePin**: Keep but maybe rename to "Due Date"
- **ScheduleToken**: Maybe combine with ReviewCadence?
- **ImportanceSeal**: Keep as "High Impact" flag

## Design Philosophy

**Goal**: Make this a real task manager with gamification, not a game that happens to use tasks.

**Old Approach**: Game-y modifiers (Schedule Token, Importance Seal) that don't map to real workflows
**New Approach**: GTD/productivity principles (Next Action, Waiting On, Review) that people actually use

**Balance**: Game should teach good task management habits:
- Next Action teaches specificity
- Waiting On teaches dependency tracking
- Review Cadence teaches regular reflection
- Checklist teaches breaking down complexity

**Rewards**: Align incentives with good practices:
- Next Action gives priority + bonus (reward clarity)
- Checklist rewards completion (reward progress)
- Review doesn't zombie (reward maintenance)
- Waiting On doesn't zombie (reward honest tracking)

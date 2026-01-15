# Donegeon Glossary

## Core Concepts

### Card
A draggable visual entity on the game board representing a game object (task, villager, modifier, resource, loot, zombie, etc.). Cards can be stacked, combined, and moved around the board. Each card type has specific interactions with other card types.

### Deck
A purchasable pack of randomized cards. Decks cost coins (except for free introductory draws) and drop various cards based on weighted probability tables. Different deck types contain different card distributions (e.g., First Day Deck focuses on basic resources, Organization Deck contains modifiers).

### Task
A todo item that progresses through zones (inbox → live → completed → archived). Tasks can have modifiers attached, be assigned to villagers for automated work, have deadlines, and recur on schedules. Completing tasks generates loot drops based on the task's inferred type.

### Blank Task
An empty task card with no name or description. Created when drawing from decks or crafting. Players can fill in the name and description to convert it into a usable task, then move it to the live zone to begin work.

### Modifier
A special card that attaches to tasks to enhance them. Four types exist: Recurring Contract (makes tasks repeat), Deadline Pin (adds time pressure), Importance Seal (prioritizes tasks), and Schedule Token (sets specific timing). Modifiers have charges (uses) unless marked as persistent (infinite uses).

### Villager
An autonomous worker card with stamina, speed, and level attributes. Villagers can be assigned to tasks to make progress automatically over time, or to resources to gather food. They need food to restore stamina and gain XP by completing tasks.

### Zombie
A penalty entity spawned when tasks are neglected (missed deadlines, recurring tasks without charges, tasks left in inbox too long). Zombies reduce loot drops and increase deck costs while active. They can be cleared by assigning villagers to work on them.

### Building
A permanent structure that provides passive bonuses or unlocks new mechanics. Buildings cost resources to construct and persist across days. Examples: Rest Hall (increases villager stamina recovery), Workshop (craft advanced modifiers).

### Slot
A conceptual unit of work capacity. Villagers assigned to tasks occupy slots, as do zombies that need clearing. The number of available slots limits how much work can happen simultaneously per day.

### Day Tick
The core game loop trigger that advances time forward. Each day: villagers reset stamina, recurring tasks check if they should spawn new instances, zombies spawn from neglected tasks, and the world state updates. Triggered manually in v0.1 via the "End Day" button.

## Zones

### Inbox
The default zone for new tasks. Tasks sit here until explicitly moved to live. Tasks left in inbox too long spawn zombies as pressure to process them.

### Live
The active work zone. Only tasks in live can be worked on by villagers, completed, or generate loot drops. This is where tasks actually happen.

### Completed
Where tasks go after being marked complete. Recurring tasks remain here until their next cycle, then spawn new instances and move to archived.

### Archived
Final resting place for one-time tasks that are complete, or old instances of recurring tasks that have spawned their next cycle.

## Resources & Inventory

### Coins
Primary currency. Used to purchase decks and construct buildings. Earned from task loot drops.

### Paper
Crafting material for planning and documentation-related items. Used in recipes for advanced modifiers.

### Ink
Crafting material for writing and scheduling tools. Combined with paper to create schedule tokens and contracts.

### Gears
Mechanical components for maintenance and automation. Used in building construction and machine-type recipes.

### Parts
Advanced components for complex buildings and tools. Rarer than gears, used for high-tier constructions.

### Blueprint Shards
Rare fragments that unlock powerful buildings or permanent upgrades. Collected over time from deep work tasks.

## Game Mechanics

### Stamina
A villager's work capacity. Each unit of stamina allows a villager to work on a task or gather resources. Resets at the start of each day. Can be restored mid-day by feeding villagers food.

### Speed
A villager attribute that determines how quickly they complete tasks or gather resources. Measured in seconds per unit of work. Improved through leveling up.

### Charges
The number of uses remaining on a modifier card. Decrements each time the modifier triggers (e.g., each recurring cycle). When charges reach zero, the modifier becomes "spent" and salvages into resources.

### Loot Drops
Random rewards generated when completing tasks. The type and amount depend on the task's inferred category (admin, planning, deep work, etc.) and current zombie penalty level.

### Progression
Tracked via TasksProcessed counter. Certain milestones unlock new decks or mechanics (e.g., Organization Deck unlocks at 10 tasks processed).

### Work Progress
Visual indicator showing how far a villager has progressed on a task. Updates in real-time based on villager speed and elapsed time.

## Status Effects

### Tired
A debuff applied to villagers when zombie pressure is high. Reduces effective speed, making work take longer. Cleared by resolving zombies or by resting (future building mechanic).

### Spent
A modifier state indicating all charges have been consumed. Spent modifiers no longer function and convert to paper/ink resources when the task completes.

### Locked/Unlocked
Deck status. Locked decks cannot be purchased until progression requirements are met (e.g., 10 tasks processed for Organization Deck).

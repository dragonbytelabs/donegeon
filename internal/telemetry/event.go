package telemetry

import "time"

type EventType string

const (
	EventTaskCreated      EventType = "task_created"
	EventTaskCompleted    EventType = "task_completed"
	EventDayTick          EventType = "day_tick"
	EventModifierAttached EventType = "modifier_attached"
	EventModifierSpent    EventType = "modifier_spent"
	EventModifierSalvaged EventType = "modifier_salvaged"
	EventZombieSpawned    EventType = "zombie_spawned"
	EventZombieCleared    EventType = "zombie_cleared"
	EventDeckOpened       EventType = "deck_opened"
	EventDeckDropReceived EventType = "deck_drop_received"
	EventLootCollected    EventType = "loot_collected"
	EventVillagerAssigned EventType = "villager_assigned"
	EventRecipeExecuted   EventType = "recipe_executed"
)

type Event struct {
	ID        int       `json:"id"`
	Type      EventType `json:"type"`
	Timestamp time.Time `json:"timestamp"`
	Metadata  string    `json:"metadata"`
}

type EventMetadata map[string]interface{}

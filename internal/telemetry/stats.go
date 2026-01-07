package telemetry

import (
	"encoding/json"
	"time"
)

type Stats struct {
	Period          string            `json:"period"`
	EventCounts     map[EventType]int `json:"event_counts"`
	TasksPerDay     float64           `json:"tasks_per_day"`
	TaskCompletions int               `json:"task_completions"`
	ZombiesPerDay   float64           `json:"zombies_per_day"`
	ZombieSpawns    int               `json:"zombie_spawns"`
	ZombieClears    int               `json:"zombie_clears"`
	DayTicks        int               `json:"day_ticks"`
	DeckOpens       int               `json:"deck_opens"`
	LootByType      map[string]int    `json:"loot_by_type"`
	ModifierUsage   map[string]int    `json:"modifier_usage"`
}

// CalculateStats computes balance stats from events
func CalculateStats(events []Event, since time.Time) (Stats, error) {
	stats := Stats{
		Period:        since.Format("2006-01-02"),
		EventCounts:   make(map[EventType]int),
		LootByType:    make(map[string]int),
		ModifierUsage: make(map[string]int),
	}

	for _, event := range events {
		stats.EventCounts[event.Type]++

		// Parse metadata for specific stats
		var metadata EventMetadata
		if err := json.Unmarshal([]byte(event.Metadata), &metadata); err != nil {
			continue
		}

		switch event.Type {
		case EventTaskCompleted:
			stats.TaskCompletions++
		case EventZombieSpawned:
			stats.ZombieSpawns++
		case EventZombieCleared:
			stats.ZombieClears++
		case EventDayTick:
			stats.DayTicks++
		case EventDeckOpened:
			stats.DeckOpens++
		case EventLootCollected:
			if lootType, ok := metadata["loot_type"].(string); ok {
				stats.LootByType[lootType]++
			}
		case EventModifierAttached:
			if modType, ok := metadata["modifier_type"].(string); ok {
				stats.ModifierUsage[modType]++
			}
		}
	}

	// Calculate per-day rates
	if stats.DayTicks > 0 {
		stats.TasksPerDay = float64(stats.TaskCompletions) / float64(stats.DayTicks)
		stats.ZombiesPerDay = float64(stats.ZombieSpawns) / float64(stats.DayTicks)
	}

	return stats, nil
}

package world

import "time"

type World struct {
	Day            time.Time `json:"day"`
	TasksProcessed int       `json:"tasks_processed"` // Total tasks moved to live (for unlock triggers)
	LootPenaltyPct int       `json:"loot_penalty_pct"`
	PackCostPct    int       `json:"pack_cost_pct"`
	Overrun        bool      `json:"overrun"`
}

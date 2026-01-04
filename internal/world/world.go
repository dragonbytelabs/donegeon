package world

import "time"

type World struct {
	Day            time.Time `json:"day"`
	LootPenaltyPct int       `json:"loot_penalty_pct"`
	PackCostPct    int       `json:"pack_cost_pct"`
	Overrun        bool      `json:"overrun"`
}

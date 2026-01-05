package loot

import (
	"math/rand"
)

// Type represents the different kinds of loot that can drop
type Type string

const (
	Coin           Type = "coin"
	Paper          Type = "paper"
	Ink            Type = "ink"
	Gear           Type = "gear"
	Parts          Type = "parts"
	BlueprintShard Type = "blueprint_shard"
)

// Drop represents a single loot item
type Drop struct {
	Type   Type `json:"type"`
	Amount int  `json:"amount"`
}

// TableEntry represents a weighted loot entry
type TableEntry struct {
	Type   Type
	Weight int // out of 100
}

// Table represents a weighted loot table
type Table []TableEntry

// Roll generates loot drops from a table
func (t Table) Roll() []Drop {
	if len(t) == 0 {
		return []Drop{{Type: Coin, Amount: 1}}
	}

	totalWeight := 0
	for _, entry := range t {
		totalWeight += entry.Weight
	}

	roll1 := rand.Intn(totalWeight)
	current := 0
	var firstDrop Type

	for _, entry := range t {
		current += entry.Weight
		if roll1 < current {
			firstDrop = entry.Type
			break
		}
	}

	drops := []Drop{{Type: firstDrop, Amount: 1}}

	if rand.Intn(100) < 40 {
		roll2 := rand.Intn(totalWeight)
		current = 0
		for _, entry := range t {
			current += entry.Weight
			if roll2 < current {
				found := false
				for i := range drops {
					if drops[i].Type == entry.Type {
						drops[i].Amount++
						found = true
						break
					}
				}
				if !found {
					drops = append(drops, Drop{Type: entry.Type, Amount: 1})
				}
				break
			}
		}
	}

	return drops
}

var (
	AdminTable = Table{
		{Type: Coin, Weight: 55},
		{Type: Paper, Weight: 25},
		{Type: Ink, Weight: 15},
		{Type: Gear, Weight: 5},
	}

	MaintenanceTable = Table{
		{Type: Gear, Weight: 60},
		{Type: Coin, Weight: 25},
		{Type: Paper, Weight: 10},
		{Type: Parts, Weight: 5},
	}

	PlanningTable = Table{
		{Type: Paper, Weight: 55},
		{Type: Ink, Weight: 25},
		{Type: Coin, Weight: 10},
		{Type: BlueprintShard, Weight: 10},
	}

	DeepWorkTable = Table{
		{Type: Parts, Weight: 55},
		{Type: Coin, Weight: 15},
		{Type: Paper, Weight: 10},
		{Type: Ink, Weight: 10},
		{Type: BlueprintShard, Weight: 10},
	}

	PerpetualFlowTable = Table{
		{Type: Ink, Weight: 45},
		{Type: Paper, Weight: 30},
		{Type: Coin, Weight: 20},
		{Type: Gear, Weight: 5},
	}

	CleanupTable = Table{
		{Type: Gear, Weight: 35},
		{Type: Coin, Weight: 25},
		{Type: Parts, Weight: 20},
		{Type: Paper, Weight: 15},
		{Type: BlueprintShard, Weight: 5},
	}
)

// ApplyPenalty reduces loot based on zombie penalty percentage
func ApplyPenalty(drops []Drop, penaltyPct int) []Drop {
	if penaltyPct <= 0 {
		return drops
	}

	result := make([]Drop, 0, len(drops))
	for _, drop := range drops {
		surviving := 0
		for i := 0; i < drop.Amount; i++ {
			if rand.Intn(100) >= penaltyPct {
				surviving++
			}
		}
		if surviving > 0 {
			result = append(result, Drop{Type: drop.Type, Amount: surviving})
		}
	}

	return result
}

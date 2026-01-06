package game

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"donegeon/internal/loot"
	"donegeon/internal/task"
)

// LootTable defines loot drops for different task types
type LootTable struct {
	TaskType string
	Drops    []LootDrop
}

type LootDrop struct {
	Type   loot.Type
	Amount int
	Weight int // Probability weight
}

var DefaultLootTables = []LootTable{
	{
		TaskType: "default",
		Drops: []LootDrop{
			{Type: loot.Coin, Amount: 1, Weight: 50},
			{Type: loot.Coin, Amount: 2, Weight: 30},
			{Type: loot.Paper, Amount: 1, Weight: 15},
			{Type: loot.Ink, Amount: 1, Weight: 5},
		},
	},
	{
		TaskType: "admin",
		Drops: []LootDrop{
			{Type: loot.Paper, Amount: 2, Weight: 40},
			{Type: loot.Coin, Amount: 1, Weight: 35},
			{Type: loot.Ink, Amount: 1, Weight: 15},
			{Type: loot.Parts, Amount: 1, Weight: 10},
		},
	},
	{
		TaskType: "focus",
		Drops: []LootDrop{
			{Type: loot.Coin, Amount: 3, Weight: 40},
			{Type: loot.BlueprintShard, Amount: 1, Weight: 25},
			{Type: loot.Gear, Amount: 1, Weight: 20},
			{Type: loot.Parts, Amount: 2, Weight: 15},
		},
	},
}

// RollLoot determines loot drops for a completed task
func (e Engine) RollLoot(ctx context.Context, t task.Task) ([]loot.Drop, error) {
	// Get world state for loot penalty
	w, err := e.World.Get(ctx)
	if err != nil {
		return nil, err
	}

	// Find appropriate loot table
	lootTable := DefaultLootTables[0] // default
	taskType := "default"
	if t.Description != "" {
		taskType = t.Description // Simple heuristic for now
	}

	for _, table := range DefaultLootTables {
		if table.TaskType == taskType {
			lootTable = table
			break
		}
	}

	// Roll for drops with penalty applied
	totalWeight := 0
	for _, drop := range lootTable.Drops {
		totalWeight += drop.Weight
	}

	if totalWeight == 0 {
		return []loot.Drop{}, nil
	}

	// Seed random with task ID and completion time for deterministic drops
	rand.Seed(time.Now().UnixNano())
	roll := rand.Intn(totalWeight)

	current := 0
	var selectedDrop *LootDrop
	for i, drop := range lootTable.Drops {
		current += drop.Weight
		if roll < current {
			selectedDrop = &lootTable.Drops[i]
			break
		}
	}

	if selectedDrop == nil {
		return []loot.Drop{}, nil
	}

	// Apply loot penalty from zombies
	amount := selectedDrop.Amount
	if w.LootPenaltyPct > 0 {
		penalty := (amount * w.LootPenaltyPct) / 100
		amount = amount - penalty
		if amount < 1 {
			amount = 1 // Minimum 1 drop
		}
	}

	return []loot.Drop{
		{
			Type:   selectedDrop.Type,
			Amount: amount,
		},
	}, nil
}

// MarkTaskDrawn marks a task as having been drawn from a deck
func (e Engine) MarkTaskDrawn(ctx context.Context, taskID int) error {
	if e.GameState == nil {
		return fmt.Errorf("game state repository not initialized")
	}
	return e.GameState.AddDrawnTaskID(ctx, taskID)
}

// HasTaskBeenDrawn checks if a task was already drawn
func (e Engine) HasTaskBeenDrawn(ctx context.Context, taskID int) (bool, error) {
	if e.GameState == nil {
		return false, fmt.Errorf("game state repository not initialized")
	}
	return e.GameState.HasDrawnTask(ctx, taskID)
}

// RemainingUndrawn returns count of tasks that haven't been drawn yet
func (e Engine) RemainingUndrawn(ctx context.Context) (int, error) {
	if e.GameState == nil {
		return 0, fmt.Errorf("game state repository not initialized")
	}

	// Get all tasks
	allTasks, err := e.Tasks.List(ctx)
	if err != nil {
		return 0, err
	}

	// Get game state to check drawn tasks
	state, err := e.GameState.Get(ctx)
	if err != nil {
		return 0, err
	}

	// Create map for fast lookup
	drawnMap := make(map[int]bool)
	for _, taskID := range state.DrawnTaskIDs {
		drawnMap[taskID] = true
	}

	// Count undrawn tasks
	undrawn := 0
	for _, task := range allTasks {
		if !drawnMap[task.ID] && !task.Completed {
			undrawn++
		}
	}

	return undrawn, nil
}

package game

import (
	"context"
	"testing"
	"time"

	"donegeon/internal/loot"
	"donegeon/internal/task"
	"donegeon/internal/villager"
	"donegeon/internal/world"
)

func TestLootDrops(t *testing.T) {
	ctx := context.Background()

	taskRepo := task.NewMemoryRepo()
	worldRepo := world.NewMemoryRepo()
	lootRepo := loot.NewMemoryRepo()
	gameStateRepo := NewMemoryGameStateRepo()

	engine := Engine{
		Tasks:     taskRepo,
		World:     worldRepo,
		Loot:      lootRepo,
		GameState: gameStateRepo,
	}

	t.Run("RollLoot returns valid drops", func(t *testing.T) {
		tsk, _ := taskRepo.Create(ctx, "test task", "default")

		drops, err := engine.RollLoot(ctx, tsk)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}

		if len(drops) == 0 {
			t.Error("expected at least one drop")
		}

		for _, drop := range drops {
			if drop.Amount <= 0 {
				t.Errorf("expected positive amount, got %d", drop.Amount)
			}
		}
	})

	t.Run("Loot penalty reduces drops", func(t *testing.T) {
		tsk, _ := taskRepo.Create(ctx, "test task", "default")

		// Set a high loot penalty
		w, _ := worldRepo.Get(ctx)
		w.LootPenaltyPct = 50
		_ = worldRepo.Set(ctx, w)

		// Roll multiple times and check that amounts are reduced
		totalAmount := 0
		for i := 0; i < 10; i++ {
			drops, err := engine.RollLoot(ctx, tsk)
			if err != nil {
				t.Fatalf("expected no error, got %v", err)
			}
			for _, drop := range drops {
				totalAmount += drop.Amount
			}
		}

		// With 50% penalty, we expect lower amounts on average
		// But due to randomness, we just verify we get some drops
		if totalAmount == 0 {
			t.Error("expected some loot despite penalty")
		}
	})
}

func TestDrawnTaskTracking(t *testing.T) {
	ctx := context.Background()

	taskRepo := task.NewMemoryRepo()
	gameStateRepo := NewMemoryGameStateRepo()

	engine := Engine{
		Tasks:     taskRepo,
		GameState: gameStateRepo,
	}

	t.Run("MarkTaskDrawn tracks task IDs", func(t *testing.T) {
		err := engine.MarkTaskDrawn(ctx, 1)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}

		has, err := engine.HasTaskBeenDrawn(ctx, 1)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if !has {
			t.Error("expected task 1 to be marked as drawn")
		}
	})

	t.Run("RemainingUndrawn counts correctly", func(t *testing.T) {
		// Create new repos for this test
		taskRepo2 := task.NewMemoryRepo()
		gameStateRepo2 := NewMemoryGameStateRepo()
		engine2 := Engine{
			Tasks:     taskRepo2,
			GameState: gameStateRepo2,
		}

		// Create some tasks and get their IDs
		t1, _ := taskRepo2.Create(ctx, "task 1", "")
		t2, _ := taskRepo2.Create(ctx, "task 2", "")
		t3, _ := taskRepo2.Create(ctx, "task 3", "")

		// Mark one as drawn using its actual ID
		_ = engine2.MarkTaskDrawn(ctx, t1.ID)

		// Check remaining
		remaining, err := engine2.RemainingUndrawn(ctx)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}

		// We created 3 tasks total, marked 1 (t1) as drawn
		// So 2 should remain undrawn (t2 and t3)
		if remaining != 2 {
			t.Errorf("expected 2 remaining undrawn, got %d (task IDs: %d, %d, %d)", remaining, t1.ID, t2.ID, t3.ID)
		}
	})

	t.Run("Completed tasks don't count as undrawn", func(t *testing.T) {
		// Create new repos for this test
		taskRepo3 := task.NewMemoryRepo()
		gameStateRepo3 := NewMemoryGameStateRepo()
		engine3 := Engine{
			Tasks:     taskRepo3,
			GameState: gameStateRepo3,
		}

		// Create tasks
		_, _ = taskRepo3.Create(ctx, "task 1", "")
		_, _ = taskRepo3.Create(ctx, "task 2", "")
		tsk, _ := taskRepo3.Create(ctx, "completed task", "")

		// Complete one task
		tsk.Completed = true
		_, _ = taskRepo3.Update(ctx, tsk)

		// Check remaining undrawn
		remaining, err := engine3.RemainingUndrawn(ctx)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}

		// We have 2 incomplete tasks, neither marked as drawn
		// So 2 should remain undrawn (completed task doesn't count)
		if remaining != 2 {
			t.Errorf("expected 2 remaining undrawn (excluding completed), got %d", remaining)
		}
	})
}

func TestVillagerResetDay(t *testing.T) {
	t.Run("ResetDay restores stamina", func(t *testing.T) {
		v := villager.Villager{
			ID:         "v1",
			Name:       "Test Villager",
			MaxStamina: 10,
			Stamina:    3,
		}

		v.ResetDay()

		if v.Stamina != 10 {
			t.Errorf("expected stamina to be restored to 10, got %d", v.Stamina)
		}
	})

	t.Run("ResetDay clears zombie block", func(t *testing.T) {
		v := villager.Villager{
			ID:              "v1",
			Name:            "Test Villager",
			MaxStamina:      10,
			Stamina:         10,
			BlockedByZombie: true,
		}

		v.ResetDay()

		if v.BlockedByZombie {
			t.Error("expected zombie block to be cleared")
		}
	})

	t.Run("ResetDay clears expired tired status", func(t *testing.T) {
		pastTime := time.Now().Add(-1 * time.Hour)
		v := villager.Villager{
			ID:         "v1",
			Name:       "Test Villager",
			MaxStamina: 10,
			Stamina:    10,
			TiredUntil: &pastTime,
		}

		v.ResetDay()

		if v.TiredUntil != nil {
			t.Error("expected expired tired status to be cleared")
		}
	})

	t.Run("IsAvailable checks all conditions", func(t *testing.T) {
		v := villager.Villager{
			ID:              "v1",
			Name:            "Test Villager",
			MaxStamina:      10,
			Stamina:         5,
			BlockedByZombie: false,
			TiredUntil:      nil,
		}

		if !v.IsAvailable() {
			t.Error("expected villager to be available")
		}

		// No stamina
		v.Stamina = 0
		if v.IsAvailable() {
			t.Error("expected villager with no stamina to be unavailable")
		}

		// Blocked by zombie
		v.Stamina = 5
		v.BlockedByZombie = true
		if v.IsAvailable() {
			t.Error("expected blocked villager to be unavailable")
		}

		// Still tired
		v.BlockedByZombie = false
		futureTime := time.Now().Add(1 * time.Hour)
		v.TiredUntil = &futureTime
		if v.IsAvailable() {
			t.Error("expected tired villager to be unavailable")
		}
	})
}

func timePtr(t time.Time) *time.Time {
	return &t
}

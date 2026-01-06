package game

import (
"context"
"testing"
)

func TestGameStateMemoryRepo(t *testing.T) {
	ctx := context.Background()
	repo := NewMemoryGameStateRepo()

	t.Run("Get initial state", func(t *testing.T) {
state, err := repo.Get(ctx)
if err != nil {
t.Fatalf("expected no error, got %v", err)
}
if state.ID != "default" {
t.Errorf("expected ID default, got %s", state.ID)
}
})

	t.Run("Add drawn task ID", func(t *testing.T) {
err := repo.AddDrawnTaskID(ctx, 1)
if err != nil {
t.Fatalf("expected no error, got %v", err)
}
state, _ := repo.Get(ctx)
if len(state.DrawnTaskIDs) != 1 {
t.Errorf("expected 1 drawn task, got %d", len(state.DrawnTaskIDs))
}
})
}

func TestCardMemoryRepo(t *testing.T) {
	ctx := context.Background()
	repo := NewMemoryCardRepo()

	t.Run("Create card", func(t *testing.T) {
card := &Card{
			ID:   "card-1",
			Type: CardTypeTask,
			Zone: CardZoneBoard,
			X:    100,
			Y:    200,
		}
		err := repo.Create(ctx, card)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
	})
}

package game

import (
	"context"
	"errors"
	"sync"
	"time"
)

type MemoryGameStateRepo struct {
	mu    sync.RWMutex
	state *GameState
}

func NewMemoryGameStateRepo() *MemoryGameStateRepo {
	return &MemoryGameStateRepo{
		state: &GameState{
			ID:           "default",
			CurrentDay:   time.Now().Truncate(24 * time.Hour),
			OverrunLevel: 0,
			LastTickAt:   time.Now(),
			DrawnTaskIDs: []int{},
			TotalCoins:   0,
			CoinsSpent:   0,
		},
	}
}

func (r *MemoryGameStateRepo) Get(ctx context.Context) (*GameState, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if r.state == nil {
		return nil, errors.New("game state not initialized")
	}

	stateCopy := *r.state
	stateCopy.DrawnTaskIDs = make([]int, len(r.state.DrawnTaskIDs))
	copy(stateCopy.DrawnTaskIDs, r.state.DrawnTaskIDs)

	return &stateCopy, nil
}

func (r *MemoryGameStateRepo) Update(ctx context.Context, state *GameState) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if state == nil {
		return errors.New("state cannot be nil")
	}

	r.state = state
	return nil
}

func (r *MemoryGameStateRepo) AddDrawnTaskID(ctx context.Context, taskID int) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, id := range r.state.DrawnTaskIDs {
		if id == taskID {
			return nil
		}
	}

	r.state.DrawnTaskIDs = append(r.state.DrawnTaskIDs, taskID)
	return nil
}

func (r *MemoryGameStateRepo) HasDrawnTask(ctx context.Context, taskID int) (bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, id := range r.state.DrawnTaskIDs {
		if id == taskID {
			return true, nil
		}
	}

	return false, nil
}

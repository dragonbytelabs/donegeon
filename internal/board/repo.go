package board

import (
	"donegeon/internal/model"
	"sync"
)

// Repo is the interface for board state persistence.
type Repo interface {
	// Load returns the current board state for the given board ID.
	Load(boardID string) (*model.BoardState, error)

	// Save persists the board state.
	Save(boardID string, state *model.BoardState) error
}

// MemoryRepo is an in-memory implementation of Repo.
type MemoryRepo struct {
	mu     sync.RWMutex
	boards map[string]*model.BoardState
}

// NewMemoryRepo creates a new in-memory board repository.
func NewMemoryRepo() *MemoryRepo {
	return &MemoryRepo{
		boards: make(map[string]*model.BoardState),
	}
}

// Load returns the board state, creating a new one if it doesn't exist.
func (r *MemoryRepo) Load(boardID string) (*model.BoardState, error) {
	r.mu.RLock()
	state, exists := r.boards[boardID]
	r.mu.RUnlock()

	if exists {
		return state, nil
	}

	// Create new board
	r.mu.Lock()
	defer r.mu.Unlock()

	// Double-check after acquiring write lock
	if state, exists = r.boards[boardID]; exists {
		return state, nil
	}

	state = model.NewBoardState()
	r.boards[boardID] = state
	return state, nil
}

// Save persists the board state.
func (r *MemoryRepo) Save(boardID string, state *model.BoardState) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.boards[boardID] = state
	return nil
}

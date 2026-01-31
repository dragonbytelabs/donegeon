package board

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"donegeon/internal/model"
)

// FileRepo persists board state to JSON files.
type FileRepo struct {
	mu      sync.RWMutex
	dataDir string
	cache   map[string]*model.BoardState
}

// NewFileRepo creates a new file-based board repository.
// dataDir is the directory where board state files will be stored.
func NewFileRepo(dataDir string) (*FileRepo, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}
	return &FileRepo{
		dataDir: dataDir,
		cache:   make(map[string]*model.BoardState),
	}, nil
}

func (r *FileRepo) filePath(boardID string) string {
	return filepath.Join(r.dataDir, boardID+".json")
}

// Load returns the board state, loading from file or creating new if not exists.
func (r *FileRepo) Load(boardID string) (*model.BoardState, error) {
	r.mu.RLock()
	if state, ok := r.cache[boardID]; ok {
		r.mu.RUnlock()
		return state, nil
	}
	r.mu.RUnlock()

	r.mu.Lock()
	defer r.mu.Unlock()

	// Double-check after acquiring write lock
	if state, ok := r.cache[boardID]; ok {
		return state, nil
	}

	// Try to load from file
	path := r.filePath(boardID)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			// Create new board
			state := model.NewBoardState()
			r.cache[boardID] = state
			return state, nil
		}
		return nil, err
	}

	var state model.BoardState
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, err
	}

	// Ensure maps are initialized
	if state.Stacks == nil {
		state.Stacks = make(map[model.StackID]*model.Stack)
	}
	if state.Cards == nil {
		state.Cards = make(map[model.CardID]*model.Card)
	}

	r.cache[boardID] = &state
	return &state, nil
}

// Save persists the board state to file.
func (r *FileRepo) Save(boardID string, state *model.BoardState) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.cache[boardID] = state

	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}

	path := r.filePath(boardID)
	return os.WriteFile(path, data, 0644)
}

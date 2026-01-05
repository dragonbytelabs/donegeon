package deck

import (
	"context"
	"sync"
)

type Repository interface {
	List(ctx context.Context) ([]Deck, error)
	Get(ctx context.Context, id string) (Deck, bool, error)
	Update(ctx context.Context, d Deck) error
	Unlock(ctx context.Context, deckType Type) error
}

type MemoryRepo struct {
	mu    sync.RWMutex
	decks map[string]Deck
}

func NewMemoryRepo() *MemoryRepo {
	return &MemoryRepo{
		decks: make(map[string]Deck),
	}
}

func (r *MemoryRepo) Seed(ctx context.Context, decks []Deck) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, d := range decks {
		r.decks[d.ID] = d
	}
	return nil
}

func (r *MemoryRepo) List(ctx context.Context) ([]Deck, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make([]Deck, 0, len(r.decks))
	for _, d := range r.decks {
		result = append(result, d)
	}
	return result, nil
}

func (r *MemoryRepo) Get(ctx context.Context, id string) (Deck, bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	d, ok := r.decks[id]
	return d, ok, nil
}

func (r *MemoryRepo) Update(ctx context.Context, d Deck) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.decks[d.ID] = d
	return nil
}

func (r *MemoryRepo) Unlock(ctx context.Context, deckType Type) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	for id, d := range r.decks {
		if d.Type == deckType {
			d.Status = StatusUnlocked
			r.decks[id] = d
			return nil
		}
	}

	return nil
}

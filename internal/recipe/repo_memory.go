package recipe

import (
	"context"
	"sort"
	"sync"
	"time"
)

type MemoryRepo struct {
	mu      sync.RWMutex
	recipes map[string]Recipe
}

func NewMemoryRepo() *MemoryRepo {
	return &MemoryRepo{recipes: make(map[string]Recipe)}
}

func (r *MemoryRepo) Seed(ctx context.Context, recipes []Recipe) error {
	_ = ctx

	r.mu.Lock()
	defer r.mu.Unlock()

	for _, rec := range recipes {
		if rec.Status == "" {
			rec.Status = StatusLocked
		}
		r.recipes[rec.ID] = rec
	}
	return nil
}

func (r *MemoryRepo) List(ctx context.Context) ([]Recipe, error) {
	_ = ctx

	r.mu.RLock()
	defer r.mu.RUnlock()

	out := make([]Recipe, 0, len(r.recipes))
	for _, rec := range r.recipes {
		out = append(out, rec)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out, nil
}

func (r *MemoryRepo) Get(ctx context.Context, id string) (Recipe, bool, error) {
	_ = ctx

	r.mu.RLock()
	defer r.mu.RUnlock()

	rec, ok := r.recipes[id]
	return rec, ok, nil
}

func (r *MemoryRepo) IsUnlocked(ctx context.Context, id string) (bool, error) {
	_ = ctx

	r.mu.RLock()
	defer r.mu.RUnlock()

	rec, ok := r.recipes[id]
	if !ok {
		return false, nil
	}
	return rec.Status == StatusUnlocked, nil
}

func (r *MemoryRepo) Unlock(ctx context.Context, id string) (Recipe, bool, error) {
	_ = ctx

	r.mu.Lock()
	defer r.mu.Unlock()

	rec, ok := r.recipes[id]
	if !ok {
		return Recipe{}, false, nil
	}

	if rec.Status != StatusUnlocked {
		now := time.Now()
		rec.Status = StatusUnlocked
		rec.UnlockedAt = &now
		r.recipes[id] = rec
	}

	return rec, true, nil
}

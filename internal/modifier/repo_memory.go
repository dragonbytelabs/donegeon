package modifier

import (
	"context"
	"sort"
	"sync"
)

type MemoryRepo struct {
	mu sync.RWMutex
	m  map[string]Card
}

func NewMemoryRepo() *MemoryRepo {
	return &MemoryRepo{m: map[string]Card{}}
}

func (r *MemoryRepo) Seed(ctx context.Context, cards []Card) error {
	_ = ctx
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, c := range cards {
		r.m[c.ID] = c
	}
	return nil
}

func (r *MemoryRepo) List(ctx context.Context) ([]Card, error) {
	_ = ctx
	r.mu.RLock()
	defer r.mu.RUnlock()

	out := make([]Card, 0, len(r.m))
	for _, c := range r.m {
		out = append(out, c)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out, nil
}

func (r *MemoryRepo) Get(ctx context.Context, id string) (Card, bool, error) {
	_ = ctx
	r.mu.RLock()
	defer r.mu.RUnlock()
	c, ok := r.m[id]
	return c, ok, nil
}

func (r *MemoryRepo) Create(ctx context.Context, c Card) (Card, error) {
	_ = ctx
	r.mu.Lock()
	defer r.mu.Unlock()
	r.m[c.ID] = c
	c.Normalize()
	return c, nil
}

func (r *MemoryRepo) Update(ctx context.Context, c Card) (Card, error) {
	_ = ctx
	r.mu.Lock()
	defer r.mu.Unlock()
	r.m[c.ID] = c
	c.Normalize()
	return c, nil
}

func (r *MemoryRepo) Delete(ctx context.Context, id string) (bool, error) {
	_ = ctx
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.m[id]; !ok {
		return false, nil
	}
	delete(r.m, id)
	return true, nil
}

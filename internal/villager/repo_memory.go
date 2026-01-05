package villager

import (
	"context"
	"sort"
	"sync"
)

type MemoryRepo struct {
	mu sync.RWMutex
	m  map[string]Villager
}

func NewMemoryRepo() *MemoryRepo {
	return &MemoryRepo{m: map[string]Villager{}}
}

func (r *MemoryRepo) Seed(ctx context.Context, vs []Villager) error {
	_ = ctx
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, v := range vs {
		r.m[v.ID] = v
	}
	return nil
}

func (r *MemoryRepo) List(ctx context.Context) ([]Villager, error) {
	_ = ctx
	r.mu.RLock()
	defer r.mu.RUnlock()

	out := make([]Villager, 0, len(r.m))
	for _, v := range r.m {
		out = append(out, v)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out, nil
}

func (r *MemoryRepo) Get(ctx context.Context, id string) (Villager, bool, error) {
	_ = ctx
	r.mu.RLock()
	defer r.mu.RUnlock()

	v, ok := r.m[id]
	return v, ok, nil
}

func (r *MemoryRepo) Update(ctx context.Context, v Villager) (Villager, error) {
	_ = ctx
	r.mu.Lock()
	defer r.mu.Unlock()

	r.m[v.ID] = v
	return v, nil
}

func (r *MemoryRepo) UpdateMany(ctx context.Context, vs []Villager) error {
	_ = ctx
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, v := range vs {
		r.m[v.ID] = v
	}
	return nil
}

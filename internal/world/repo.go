package world

import (
	"context"
	"sync"
	"time"
)

type MemoryRepo struct {
	mu sync.RWMutex
	w  World
}

func NewMemoryRepo() *MemoryRepo {
	// start at "today" (date only)
	now := time.Now()
	day := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	return &MemoryRepo{w: World{Day: day}}
}

func (r *MemoryRepo) Get(ctx context.Context) (World, error) {
	_ = ctx
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.w, nil
}

func (r *MemoryRepo) Set(ctx context.Context, w World) error {
	_ = ctx
	r.mu.Lock()
	defer r.mu.Unlock()
	r.w = w
	return nil
}

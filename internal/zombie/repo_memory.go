package zombie

import (
	"context"
	"sync"
)

type MemoryRepo struct {
	mu sync.RWMutex
	zs []Zombie
}

func NewMemoryRepo() *MemoryRepo { return &MemoryRepo{zs: []Zombie{}} }

func (r *MemoryRepo) List(ctx context.Context) ([]Zombie, error) {
	_ = ctx
	r.mu.RLock()
	defer r.mu.RUnlock()

	out := make([]Zombie, len(r.zs))
	copy(out, r.zs)
	return out, nil
}

func (r *MemoryRepo) Add(ctx context.Context, z Zombie) error {
	_ = ctx
	r.mu.Lock()
	defer r.mu.Unlock()
	r.zs = append(r.zs, z)
	return nil
}

func (r *MemoryRepo) Count(ctx context.Context) (int, error) {
	_ = ctx
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.zs), nil
}

func (r *MemoryRepo) ExistsForTask(ctx context.Context, taskID int, reason string) (bool, error) {
	_ = ctx
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, z := range r.zs {
		if z.TaskID == taskID && z.Reason == reason {
			return true, nil
		}
	}
	return false, nil
}

func (r *MemoryRepo) Remove(ctx context.Context, id string) (bool, error) {
	_ = ctx
	r.mu.Lock()
	defer r.mu.Unlock()

	for i := range r.zs {
		if r.zs[i].ID == id {
			r.zs = append(r.zs[:i], r.zs[i+1:]...)
			return true, nil
		}
	}
	return false, nil
}

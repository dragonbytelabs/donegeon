package task

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type MemoryRepo struct {
	mu    sync.RWMutex
	tasks map[int]Task
}

func NewMemoryRepo() *MemoryRepo {
	return &MemoryRepo{
		tasks: make(map[int]Task),
	}
}

func (r *MemoryRepo) Create(ctx context.Context, name, description string) (Task, error) {
	_ = ctx

	t := NewTask(name, description)

	r.mu.Lock()
	r.tasks[t.ID] = t
	r.mu.Unlock()

	return t, nil
}

func (r *MemoryRepo) Get(ctx context.Context, id int) (Task, bool, error) {
	_ = ctx

	r.mu.RLock()
	t, ok := r.tasks[id]
	r.mu.RUnlock()

	return t, ok, nil
}

func (r *MemoryRepo) List(ctx context.Context) ([]Task, error) {
	_ = ctx

	r.mu.RLock()
	defer r.mu.RUnlock()

	out := make([]Task, 0, len(r.tasks))
	for _, t := range r.tasks {
		out = append(out, t)
	}
	return out, nil
}

func (r *MemoryRepo) Delete(ctx context.Context, id int) (bool, error) {
	_ = ctx

	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.tasks[id]; !ok {
		return false, nil
	}
	delete(r.tasks, id)
	return true, nil
}

func (r *MemoryRepo) AddTag(ctx context.Context, id int, tag string) (Task, bool, error) {
	_ = ctx
	r.mu.Lock()
	defer r.mu.Unlock()

	t, ok := r.tasks[id]
	if !ok {
		return Task{}, false, nil
	}
	t.AddTag(tag)
	r.tasks[id] = t
	return t, true, nil
}

func (r *MemoryRepo) Complete(ctx context.Context, id int) (Task, bool, error) {
	_ = ctx
	r.mu.Lock()
	defer r.mu.Unlock()

	t, ok := r.tasks[id]
	if !ok {
		return Task{}, false, nil
	}
	t.MarkComplete()
	t.touch()
	r.tasks[id] = t
	return t, true, nil
}

func (r *MemoryRepo) Process(ctx context.Context, id int) (Task, bool, error) {
	_ = ctx

	r.mu.Lock()
	defer r.mu.Unlock()

	t, ok := r.tasks[id]
	if !ok {
		return Task{}, false, nil
	}

	// Already live? idempotent.
	if t.Zone == ZoneLive {
		return t, true, nil
	}

	now := time.Now()
	t.Zone = ZoneLive
	t.LiveAt = &now
	t.touch()
	r.tasks[id] = t

	return t, true, nil
}

func (r *MemoryRepo) ListByZone(ctx context.Context, zone Zone) ([]Task, error) {
	_ = ctx

	r.mu.RLock()
	defer r.mu.RUnlock()

	out := make([]Task, 0)
	for _, t := range r.tasks {
		if t.Zone == zone {
			out = append(out, t)
		}
	}
	return out, nil
}

func (r *MemoryRepo) Update(ctx context.Context, t Task) (Task, error) {
	_ = ctx
	r.mu.Lock()
	defer r.mu.Unlock()

	// if missing, treat as create error
	if _, ok := r.tasks[t.ID]; !ok {
		return Task{}, fmt.Errorf("task not found: %d", t.ID)
	}
	t.touch()
	r.tasks[t.ID] = t
	return t, nil
}

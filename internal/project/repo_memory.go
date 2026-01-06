package project

import (
	"context"
	"errors"
	"sync"
)

type MemoryRepo struct {
	mu sync.RWMutex
	m  map[int]Project
}

func NewMemoryRepo() *MemoryRepo {
	return &MemoryRepo{
		m: make(map[int]Project),
	}
}

func (r *MemoryRepo) Create(ctx context.Context, name, description string) (Project, error) {
	_ = ctx
	p := NewProject(name, description)

	r.mu.Lock()
	defer r.mu.Unlock()

	r.m[p.ID] = p
	return p, nil
}

func (r *MemoryRepo) Get(ctx context.Context, id int) (Project, bool, error) {
	_ = ctx
	r.mu.RLock()
	defer r.mu.RUnlock()

	p, ok := r.m[id]
	return p, ok, nil
}

func (r *MemoryRepo) List(ctx context.Context) ([]Project, error) {
	_ = ctx
	r.mu.RLock()
	defer r.mu.RUnlock()

	projects := make([]Project, 0, len(r.m))
	for _, p := range r.m {
		if !p.Archived {
			projects = append(projects, p)
		}
	}
	return projects, nil
}

func (r *MemoryRepo) Update(ctx context.Context, p Project) (Project, error) {
	_ = ctx
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.m[p.ID]; !exists {
		return Project{}, errors.New("project not found")
	}

	r.m[p.ID] = p
	return p, nil
}

func (r *MemoryRepo) Delete(ctx context.Context, id int) error {
	_ = ctx
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.m, id)
	return nil
}

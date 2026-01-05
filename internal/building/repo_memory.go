package building

import (
	"context"
	"sync"
)

type Repository interface {
	List(ctx context.Context) ([]Building, error)
	Get(ctx context.Context, id string) (Building, bool, error)
	GetByType(ctx context.Context, buildingType Type) (Building, bool, error)
	Update(ctx context.Context, b Building) error
	Build(ctx context.Context, buildingType Type) error
	IsBuilt(ctx context.Context, buildingType Type) (bool, error)
}

type MemoryRepo struct {
	mu        sync.RWMutex
	buildings map[string]Building
}

func NewMemoryRepo() *MemoryRepo {
	return &MemoryRepo{
		buildings: make(map[string]Building),
	}
}

func (r *MemoryRepo) Seed(ctx context.Context, buildings []Building) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, b := range buildings {
		r.buildings[b.ID] = b
	}
	return nil
}

func (r *MemoryRepo) List(ctx context.Context) ([]Building, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make([]Building, 0, len(r.buildings))
	for _, b := range r.buildings {
		result = append(result, b)
	}
	return result, nil
}

func (r *MemoryRepo) Get(ctx context.Context, id string) (Building, bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	b, ok := r.buildings[id]
	return b, ok, nil
}

func (r *MemoryRepo) GetByType(ctx context.Context, buildingType Type) (Building, bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, b := range r.buildings {
		if b.Type == buildingType {
			return b, true, nil
		}
	}

	return Building{}, false, nil
}

func (r *MemoryRepo) Update(ctx context.Context, b Building) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.buildings[b.ID] = b
	return nil
}

func (r *MemoryRepo) Build(ctx context.Context, buildingType Type) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	for id, b := range r.buildings {
		if b.Type == buildingType {
			b.Status = StatusBuilt
			r.buildings[id] = b
			return nil
		}
	}

	return nil
}

func (r *MemoryRepo) IsBuilt(ctx context.Context, buildingType Type) (bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, b := range r.buildings {
		if b.Type == buildingType && b.Status == StatusBuilt {
			return true, nil
		}
	}

	return false, nil
}

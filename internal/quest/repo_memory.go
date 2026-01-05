package quest

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"
)

type MemoryRepo struct {
	mu     sync.RWMutex
	quests map[string]Quest
}

func NewMemoryRepo() *MemoryRepo {
	return &MemoryRepo{
		quests: make(map[string]Quest),
	}
}

func (r *MemoryRepo) Seed(ctx context.Context, quests []Quest) error {
	_ = ctx
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, q := range quests {
		if q.Status == "" {
			q.Status = StatusLocked
		}
		r.quests[q.ID] = q
	}
	return nil
}

func (r *MemoryRepo) List(ctx context.Context) ([]Quest, error) {
	_ = ctx

	r.mu.RLock()
	defer r.mu.RUnlock()

	out := make([]Quest, 0, len(r.quests))
	for _, q := range r.quests {
		out = append(out, q)
	}

	// stable ordering is nice for UI/tests
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out, nil
}

func (r *MemoryRepo) Get(ctx context.Context, id string) (Quest, bool, error) {
	_ = ctx

	r.mu.RLock()
	defer r.mu.RUnlock()

	q, ok := r.quests[id]
	return q, ok, nil
}

func (r *MemoryRepo) ListActive(ctx context.Context) ([]Quest, error) {
	_ = ctx
	r.mu.RLock()
	defer r.mu.RUnlock()

	var active []Quest
	for _, q := range r.quests {
		if q.Status == StatusActive || q.Status == StatusInProgress {
			active = append(active, q)
		}
	}

	return active, nil
}

func (r *MemoryRepo) ListByType(ctx context.Context, qtype QuestType) ([]Quest, error) {
	_ = ctx
	r.mu.RLock()
	defer r.mu.RUnlock()

	var filtered []Quest
	for _, q := range r.quests {
		if q.Type == qtype {
			filtered = append(filtered, q)
		}
	}

	return filtered, nil
}

func (r *MemoryRepo) Activate(ctx context.Context, id string) error {
	_ = ctx
	r.mu.Lock()
	defer r.mu.Unlock()

	q, ok := r.quests[id]
	if !ok {
		return fmt.Errorf("quest not found: %s", id)
	}

	now := time.Now()
	q.Status = StatusActive
	q.ActivatedAt = &now
	r.quests[id] = q

	return nil
}

func (r *MemoryRepo) Complete(ctx context.Context, id string) error {
	_ = ctx
	r.mu.Lock()
	defer r.mu.Unlock()

	q, ok := r.quests[id]
	if !ok {
		return fmt.Errorf("quest not found: %s", id)
	}

	now := time.Now()
	q.Status = StatusComplete
	q.CompletedAt = &now
	r.quests[id] = q

	return nil
}

func (r *MemoryRepo) UpdateProgress(ctx context.Context, id string, progress []Progress) error {
	_ = ctx
	r.mu.Lock()
	defer r.mu.Unlock()

	q, ok := r.quests[id]
	if !ok {
		return fmt.Errorf("quest not found: %s", id)
	}

	q.Progress = progress

	// If all objectives complete, mark as in-progress
	allComplete := true
	for _, p := range progress {
		if !p.Complete {
			allComplete = false
			break
		}
	}

	if allComplete && q.Status == StatusActive {
		q.Status = StatusInProgress
	}

	r.quests[id] = q
	return nil
}

func ptrTime(t time.Time) *time.Time { return &t }

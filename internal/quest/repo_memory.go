package quest

import (
	"context"
	"sort"
	"sync"
	"time"

	"donegeon/internal/task"
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

	now := time.Now()

	for _, q := range quests {
		// default status
		if q.Status == "" {
			q.Status = StatusLocked
		}
		// If nothing is unlocked yet, we’ll keep it locked unless caller marks active.
		if q.Status == StatusActive && q.UnlockedAt == nil {
			q.UnlockedAt = ptrTime(now)
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

func (r *MemoryRepo) Progress(ctx context.Context, tasks []task.Task) ([]Quest, error) {
	_ = ctx

	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()

	// 1) Complete any active quests whose requirements are met
	completedThisTick := []Quest{}
	for id, q := range r.quests {
		if q.Status != StatusActive {
			continue
		}
		if q.Evaluate(tasks) {
			q.Status = StatusComplete
			q.CompletedAt = ptrTime(now)
			r.quests[id] = q
			completedThisTick = append(completedThisTick, q)
		}
	}

	// 2) Apply rewards (unlock quests)
	for _, done := range completedThisTick {
		for _, unlockID := range done.Reward.UnlockQuestIDs {
			uq, ok := r.quests[unlockID]
			if !ok {
				continue
			}
			if uq.Status == StatusLocked {
				uq.Status = StatusActive
				uq.UnlockedAt = ptrTime(now)
				r.quests[unlockID] = uq
			}
		}
	}

	// return updated snapshot
	out := make([]Quest, 0, len(r.quests))
	for _, q := range r.quests {
		out = append(out, q)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out, nil
}

func ptrTime(t time.Time) *time.Time { return &t }

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
	repo := &MemoryRepo{
		tasks: make(map[int]Task),
	}
	return repo
}

// InitializeOrderValues sets Order for any tasks that don't have it set (Order=0)
// This is useful after adding the Order field to existing tasks
func (r *MemoryRepo) InitializeOrderValues() {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Group tasks by zone
	byZone := make(map[Zone][]Task)
	for _, t := range r.tasks {
		byZone[t.Zone] = append(byZone[t.Zone], t)
	}

	// For each zone, assign order values based on task ID
	for zone, tasks := range byZone {
		// Sort by ID to have a deterministic order
		for i := 0; i < len(tasks); i++ {
			for j := i + 1; j < len(tasks); j++ {
				if tasks[i].ID > tasks[j].ID {
					tasks[i], tasks[j] = tasks[j], tasks[i]
				}
			}
		}

		// Assign order values
		for i, t := range tasks {
			if t.Order == 0 { // Only update if not already set
				t.Order = i
				r.tasks[t.ID] = t
			}
		}
		_ = zone // use zone to avoid unused warning
	}
}

func (r *MemoryRepo) Create(ctx context.Context, name, description string) (Task, error) {
	_ = ctx

	t := NewTask(name, description)

	r.mu.Lock()
	defer r.mu.Unlock()

	// Set order to be last in its zone
	maxOrder := -1
	for _, existing := range r.tasks {
		if existing.Zone == t.Zone && existing.Order > maxOrder {
			maxOrder = existing.Order
		}
	}
	t.Order = maxOrder + 1

	r.tasks[t.ID] = t

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

	// Set order to be last in live zone
	maxOrder := -1
	for _, existing := range r.tasks {
		if existing.Zone == ZoneLive && existing.Order > maxOrder {
			maxOrder = existing.Order
		}
	}
	t.Order = maxOrder + 1

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

	// Sort by order
	for i := 0; i < len(out); i++ {
		for j := i + 1; j < len(out); j++ {
			if out[i].Order > out[j].Order {
				out[i], out[j] = out[j], out[i]
			}
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

func (r *MemoryRepo) Reorder(ctx context.Context, sourceID int, targetID int) error {
	_ = ctx
	r.mu.Lock()
	defer r.mu.Unlock()

	source, sourceOk := r.tasks[sourceID]
	target, targetOk := r.tasks[targetID]

	if !sourceOk {
		return fmt.Errorf("source task not found: %d", sourceID)
	}
	if !targetOk {
		return fmt.Errorf("target task not found: %d", targetID)
	}

	// Only reorder within the same zone
	if source.Zone != target.Zone {
		return fmt.Errorf("cannot reorder tasks across zones")
	}

	// Get all tasks in this zone sorted by order
	zoneTasks := make([]Task, 0)
	for _, t := range r.tasks {
		if t.Zone == source.Zone {
			zoneTasks = append(zoneTasks, t)
		}
	}

	// Sort by current order
	for i := 0; i < len(zoneTasks); i++ {
		for j := i + 1; j < len(zoneTasks); j++ {
			if zoneTasks[i].Order > zoneTasks[j].Order {
				zoneTasks[i], zoneTasks[j] = zoneTasks[j], zoneTasks[i]
			}
		}
	}

	// Find source and target positions
	sourceIdx, targetIdx := -1, -1
	for i, t := range zoneTasks {
		if t.ID == sourceID {
			sourceIdx = i
		}
		if t.ID == targetID {
			targetIdx = i
		}
	}

	// Remove source from its position
	if sourceIdx != -1 {
		zoneTasks = append(zoneTasks[:sourceIdx], zoneTasks[sourceIdx+1:]...)
		// Adjust target index if needed
		if sourceIdx < targetIdx {
			targetIdx--
		}
	}

	// Insert source at target position
	if targetIdx >= 0 && targetIdx <= len(zoneTasks) {
		zoneTasks = append(zoneTasks[:targetIdx], append([]Task{source}, zoneTasks[targetIdx:]...)...)
	}

	// Reassign order values
	for i, t := range zoneTasks {
		t.Order = i
		t.touch()
		r.tasks[t.ID] = t
	}

	return nil
}

// CountCreatedToday counts tasks created today
func (r *MemoryRepo) CountCreatedToday(ctx context.Context) (int, error) {
	_ = ctx
	r.mu.RLock()
	defer r.mu.RUnlock()

	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	count := 0
	for _, t := range r.tasks {
		if t.CreatedAt.After(startOfDay) {
			count++
		}
	}
	return count, nil
}

// CountCompletedToday counts tasks completed today
func (r *MemoryRepo) CountCompletedToday(ctx context.Context) (int, error) {
	_ = ctx
	r.mu.RLock()
	defer r.mu.RUnlock()

	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	count := 0
	for _, t := range r.tasks {
		if t.Completed && t.UpdatedAt.After(startOfDay) {
			count++
		}
	}
	return count, nil
}

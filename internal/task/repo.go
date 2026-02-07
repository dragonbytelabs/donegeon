package task

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sort"
	"strings"
	"sync"
	"time"

	"donegeon/internal/model"
)

var (
	ErrNotFound    = errors.New("task not found")
	ErrTooManyMods = errors.New("too many modifiers (max 4)")
)

// Patch represents a partial update.
// nil pointer => "no change"
// empty string for pointer fields (Project/DueDate) => clear (set to nil)
type Patch struct {
	Title       *string   `json:"title,omitempty"`
	Description *string   `json:"description,omitempty"`
	Done        *bool     `json:"done,omitempty"`
	Project     *string   `json:"project,omitempty"`
	Tags        *[]string `json:"tags,omitempty"`

	Modifiers  *[]model.TaskModifierSlot `json:"modifiers,omitempty"`
	DueDate    *string                   `json:"dueDate,omitempty"`
	NextAction *bool                     `json:"nextAction,omitempty"`
	Recurrence *model.Recurrence         `json:"recurrence,omitempty"`

	// Internal fields (not exposed via JSON API directly).
	AssignedVillagerID  *string `json:"-"`
	WorkedToday         *bool   `json:"-"`
	ProcessedCountDelta *int    `json:"-"`
}

type ListFilter struct {
	// Status:
	//   "" | "all" | "pending" | "done" | "due_today" | "upcoming" | "overdue"
	Status string

	// Project:
	//   "" | "any" | "inbox" | "projects" | "<exact project name>"
	Project string

	// Live:
	//   nil = don't care
	//   true/false = filter tasks by "live" state (board tasks)
	Live *bool
}

type Repo interface {
	Create(t model.Task) (model.Task, error)
	Get(id model.TaskID) (model.Task, error)
	Update(id model.TaskID, patch Patch) (model.Task, error)
	List(filter ListFilter) ([]model.Task, error)
	SetModifiers(id model.TaskID, mods []model.TaskModifierSlot) (model.Task, error)
	SyncLive(taskIDs []model.TaskID) error
	SetLive(id model.TaskID, live bool) error
}

type MemoryRepo struct {
	mu        sync.RWMutex
	tasks     map[model.TaskID]model.Task
	liveIndex map[model.TaskID]bool
}

func NewMemoryRepo() *MemoryRepo {
	return &MemoryRepo{
		tasks:     map[model.TaskID]model.Task{},
		liveIndex: map[model.TaskID]bool{},
	}
}

// SyncLive replaces the server's notion of which tasks are "live on the board".
func (r *MemoryRepo) SyncLive(taskIDs []model.TaskID) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	next := make(map[model.TaskID]bool, len(taskIDs))
	for _, id := range taskIDs {
		if id == "" {
			continue
		}
		if t, ok := r.tasks[id]; ok && !t.Done {
			next[id] = true
		}
	}
	r.liveIndex = next
	return nil
}

func (r *MemoryRepo) SetLive(id model.TaskID, live bool) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	t, ok := r.tasks[id]
	if !ok {
		return ErrNotFound
	}

	// done tasks can never be live
	if t.Done {
		delete(r.liveIndex, id)
		return nil
	}

	if live {
		r.liveIndex[id] = true
	} else {
		delete(r.liveIndex, id)
	}
	return nil
}

func newID(prefix string) model.TaskID {
	var b [8]byte
	_, _ = rand.Read(b[:])
	return model.TaskID(prefix + "_" + hex.EncodeToString(b[:]))
}

func normalizeTask(t *model.Task) {
	if t.Tags == nil {
		t.Tags = []string{}
	}
	if t.Modifiers == nil {
		t.Modifiers = []model.TaskModifierSlot{}
	}
}

func applyPatch(t *model.Task, p Patch) error {
	if p.Title != nil {
		t.Title = *p.Title
	}
	if p.Description != nil {
		t.Description = *p.Description
	}
	if p.Done != nil {
		t.Done = *p.Done
	}

	// pointer string field with "empty clears" semantics
	if p.Project != nil {
		if *p.Project == "" {
			t.Project = nil
		} else {
			t.Project = p.Project
		}
	}
	if p.DueDate != nil {
		if *p.DueDate == "" {
			t.DueDate = nil
		} else {
			t.DueDate = p.DueDate
		}
	}

	if p.Tags != nil {
		// treat nil slice as empty slice
		if *p.Tags == nil {
			t.Tags = []string{}
		} else {
			t.Tags = *p.Tags
		}
	}

	if p.Modifiers != nil {
		if *p.Modifiers == nil {
			t.Modifiers = []model.TaskModifierSlot{}
		} else {
			if len(*p.Modifiers) > 4 {
				return ErrTooManyMods
			}
			t.Modifiers = *p.Modifiers
		}
	}

	if p.NextAction != nil {
		t.NextAction = *p.NextAction
	}
	if p.Recurrence != nil {
		// NOTE: if you need "clear recurrence" via JSON null, you’ll want a pointer-to-pointer.
		t.Recurrence = p.Recurrence
	}
	if p.AssignedVillagerID != nil {
		if strings.TrimSpace(*p.AssignedVillagerID) == "" {
			t.AssignedVillagerID = nil
		} else {
			v := strings.TrimSpace(*p.AssignedVillagerID)
			t.AssignedVillagerID = &v
		}
	}
	if p.WorkedToday != nil {
		t.WorkedToday = *p.WorkedToday
	}
	if p.ProcessedCountDelta != nil && *p.ProcessedCountDelta != 0 {
		next := t.ProcessedCount + *p.ProcessedCountDelta
		if next < 0 {
			next = 0
		}
		t.ProcessedCount = next
	}

	return nil
}

func (r *MemoryRepo) Create(t model.Task) (model.Task, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	t.ID = newID("task")
	t.CreatedAt = now
	t.UpdatedAt = now

	normalizeTask(&t)

	r.tasks[t.ID] = t
	return t, nil
}

func (r *MemoryRepo) Get(id model.TaskID) (model.Task, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	t, ok := r.tasks[id]
	if !ok {
		return model.Task{}, ErrNotFound
	}
	normalizeTask(&t)
	return t, nil
}

func (r *MemoryRepo) Update(id model.TaskID, p Patch) (model.Task, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	t, ok := r.tasks[id]
	if !ok {
		return model.Task{}, ErrNotFound
	}

	if err := applyPatch(&t, p); err != nil {
		return model.Task{}, err
	}

	// If a task is marked done, it can no longer be live.
	if t.Done {
		r.liveIndex[t.ID] = false
	}

	t.UpdatedAt = time.Now()
	normalizeTask(&t)

	r.tasks[id] = t
	return t, nil
}

func (r *MemoryRepo) List(filter ListFilter) ([]model.Task, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	// "today" in server local time (YYYY-MM-DD)
	today := time.Now().Format("2006-01-02")

	status := strings.ToLower(strings.TrimSpace(filter.Status))
	projectFilter := strings.TrimSpace(filter.Project)
	projectFilterLower := strings.ToLower(projectFilter)

	out := make([]model.Task, 0, len(r.tasks))

	for _, t0 := range r.tasks {
		// work on a copy so we can normalize + compute Live safely
		t := t0
		normalizeTask(&t)

		// ✅ compute live from the server index
		if t.Done {
			t.Live = false
		} else if r.liveIndex != nil {
			t.Live = r.liveIndex[t.ID] && !t.Done
		} else {
			t.Live = false
		}

		// --- live filter ---
		if filter.Live != nil {
			if t.Live != *filter.Live {
				continue
			}
		}

		// --- project filter ---
		p := ""
		if t.Project != nil {
			p = strings.TrimSpace(*t.Project)
		}
		switch projectFilterLower {
		case "", "any":
			// no-op
		case "inbox":
			if p != "inbox" {
				continue
			}
		case "projects":
			// project != inbox
			if p == "" || p == "inbox" {
				continue
			}
		default:
			// exact match (case-sensitive or normalize as you prefer)
			if p != projectFilter {
				continue
			}
		}

		// --- status filter ---
		switch status {
		case "", "all":
			// no-op
		case "pending":
			if t.Done {
				continue
			}
		case "done":
			if !t.Done {
				continue
			}
		case "due_today":
			if t.Done || t.DueDate == nil || *t.DueDate != today {
				continue
			}
		case "overdue":
			if t.Done || t.DueDate == nil || *t.DueDate >= today {
				continue
			}
		case "upcoming":
			if t.Done || t.DueDate == nil || *t.DueDate <= today {
				continue
			}
		default:
			// unknown => treat as "all"
		}

		out = append(out, t)
	}

	// Sort: due soonest first (nil due dates last), then updated desc
	sort.Slice(out, func(i, j int) bool {
		di, dj := out[i].DueDate, out[j].DueDate
		switch {
		case di == nil && dj == nil:
			return out[i].UpdatedAt.After(out[j].UpdatedAt)
		case di == nil:
			return false
		case dj == nil:
			return true
		case *di != *dj:
			return *di < *dj
		default:
			return out[i].UpdatedAt.After(out[j].UpdatedAt)
		}
	})

	return out, nil
}

func (r *MemoryRepo) SetModifiers(id model.TaskID, mods []model.TaskModifierSlot) (model.Task, error) {
	// Make this just a wrapper around Update to avoid duplicate logic.
	p := Patch{Modifiers: &mods}
	return r.Update(id, p)
}

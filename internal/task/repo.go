package task

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
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
}

type Repo interface {
	Create(t model.Task) (model.Task, error)
	Get(id model.TaskID) (model.Task, error)
	Update(id model.TaskID, patch Patch) (model.Task, error)
	SetModifiers(id model.TaskID, mods []model.TaskModifierSlot) (model.Task, error)
}

type MemoryRepo struct {
	mu    sync.RWMutex
	tasks map[model.TaskID]model.Task
}

func NewMemoryRepo() *MemoryRepo {
	return &MemoryRepo{tasks: map[model.TaskID]model.Task{}}
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

	t.UpdatedAt = time.Now()
	normalizeTask(&t)

	r.tasks[id] = t
	return t, nil
}

func (r *MemoryRepo) SetModifiers(id model.TaskID, mods []model.TaskModifierSlot) (model.Task, error) {
	// Make this just a wrapper around Update to avoid duplicate logic.
	p := Patch{Modifiers: &mods}
	return r.Update(id, p)
}

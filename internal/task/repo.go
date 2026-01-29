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

type Patch struct {
	Title       *string   `json:"title,omitempty"`
	Description *string   `json:"description,omitempty"`
	Done        *bool     `json:"done,omitempty"`
	Project     *string   `json:"project,omitempty"`
	Tags        *[]string `json:"tags,omitempty"`

	Modifiers  *[]string         `json:"modifiers,omitempty"`
	DueDate    *string           `json:"dueDate,omitempty"`
	NextAction *bool             `json:"nextAction,omitempty"`
	Recurrence *model.Recurrence `json:"recurrence,omitempty"`
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

func (r *MemoryRepo) Create(t model.Task) (model.Task, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	t.ID = newID("task")
	t.CreatedAt = now
	t.UpdatedAt = now

	if t.Tags == nil {
		t.Tags = []string{}
	}
	if t.Modifiers == nil {
		t.Modifiers = []model.TaskModifierSlot{}
	}

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
	return t, nil
}

func (r *MemoryRepo) Update(id model.TaskID, p Patch) (model.Task, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	t, ok := r.tasks[id]
	if !ok {
		return model.Task{}, ErrNotFound
	}

	if p.Title != nil {
		t.Title = *p.Title
	}
	if p.Description != nil {
		t.Description = *p.Description
	}
	if p.Done != nil {
		t.Done = *p.Done
	}
	if p.Project != nil {
		if *p.Project == "" {
			t.Project = nil
		} else {
			t.Project = p.Project
		}
	}
	if p.Tags != nil {
		t.Tags = *p.Tags
	}

	t.UpdatedAt = time.Now()
	r.tasks[id] = t
	return t, nil
}

func (r *MemoryRepo) SetModifiers(id model.TaskID, mods []model.TaskModifierSlot) (model.Task, error) {
	if len(mods) > 4 {
		return model.Task{}, ErrTooManyMods
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	t, ok := r.tasks[id]
	if !ok {
		return model.Task{}, ErrNotFound
	}

	if mods == nil {
		mods = []model.TaskModifierSlot{}
	}

	t.Modifiers = mods
	t.UpdatedAt = time.Now()
	r.tasks[id] = t
	return t, nil
}

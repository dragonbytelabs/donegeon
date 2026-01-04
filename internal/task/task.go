package task

import (
	"slices"
	"sync/atomic"
	"time"
)

var nextId atomic.Int64

type Zone string

const (
	ZoneInbox Zone = "inbox"
	ZoneLive  Zone = "live"
)

type Task struct {
	ID          int        `json:"id"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Tags        []string   `json:"tags,omitempty"`
	Completed   bool       `json:"completed"`
	Zone        Zone       `json:"zone"`
	LiveAt      *time.Time `json:"live_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`

	DeadlineAt *time.Time `json:"deadline_at,omitempty"`

	RecurringEveryDays int        `json:"recurring_every_days,omitempty"`
	RecurringCharges   int        `json:"recurring_charges,omitempty"`
	RecurringNextAt    *time.Time `json:"recurring_next_at,omitempty"`

	ModifierIDs []string `json:"modifier_ids,omitempty"`
}

func getNextId() int {
	return int(nextId.Add(1))
}

func NewTask(name, description string) Task {
	id := getNextId()
	now := time.Now()

	return Task{
		ID:          id,
		Name:        name,
		Description: description,
		Tags:        nil,
		Completed:   false,
		Zone:        ZoneInbox,
		ModifierIDs: nil,
		LiveAt:      nil,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

func (t *Task) touch() {
	now := time.Now()
	t.UpdatedAt = now
}

func (t *Task) HasTag(tag string) bool {
	return slices.Contains(t.Tags, tag)
}

func (t *Task) AddTag(tag string) {
	if tag == "" || t.HasTag(tag) {
		return
	}
	t.Tags = append(t.Tags, tag)
	t.touch()
}

func (t *Task) MarkComplete() {
	t.Completed = true
	t.touch()
}

func (t *Task) HasModifier(id string) bool {
	return slices.Contains(t.ModifierIDs, id)
}

func (t *Task) AddModifier(id string) {
	if id == "" || t.HasModifier(id) {
		return
	}
	t.ModifierIDs = append(t.ModifierIDs, id)
	t.touch()
}

func (t *Task) RemoveModifier(id string) {
	if id == "" {
		return
	}
	out := make([]string, 0, len(t.ModifierIDs))
	for _, mid := range t.ModifierIDs {
		if mid != id {
			out = append(out, mid)
		}
	}
	t.ModifierIDs = out
	t.touch()
}

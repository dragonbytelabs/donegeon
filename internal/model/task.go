package model

import (
	"time"
)

type TaskID string

type Recurrence struct {
	Type     string `json:"type"`
	Interval int    `json:"interval"`
}

type Task struct {
	ID          TaskID   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Done        bool     `json:"done"`
	Project     *string  `json:"project,omitempty"`
	Tags        []string `json:"tags,omitempty"`

	Modifiers  []TaskModifierSlot `json:"modifiers,omitempty"`
	DueDate    *string            `json:"dueDate,omitempty"`
	NextAction bool               `json:"nextAction"`
	Recurrence *Recurrence        `json:"recurrence,omitempty"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type TaskModifierSlot struct {
	DefID string         `json:"defId"`          // e.g. "mod.recurring"
	Data  map[string]any `json:"data,omitempty"` // modifier-specific editable fields
}

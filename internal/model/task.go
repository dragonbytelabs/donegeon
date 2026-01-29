package model

import "time"

type TaskID string

type Task struct {
	ID          TaskID   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Done        bool     `json:"done"`
	Project     *string  `json:"project,omitempty"`
	Tags        []string `json:"tags,omitempty"`

	// Exactly what the UI needs to render dynamic fields:
	// max 4 slots, each slot is a modifier def + its editable data.
	Modifiers []TaskModifierSlot `json:"modifiers,omitempty"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type TaskModifierSlot struct {
	DefID string         `json:"defId"`          // e.g. "mod.recurring"
	Data  map[string]any `json:"data,omitempty"` // modifier-specific editable fields
}

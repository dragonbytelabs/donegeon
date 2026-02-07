package model

import "time"

type BlueprintID string

type Blueprint struct {
	ID            BlueprintID `json:"id"`
	Title         string      `json:"title"`
	Description   string      `json:"description"`
	ModifierSlots []string    `json:"modifierSlots,omitempty"`
	Steps         []string    `json:"steps,omitempty"`
	CreatedAt     time.Time   `json:"createdAt"`
	UpdatedAt     time.Time   `json:"updatedAt"`
}

type BlueprintUpsert struct {
	Title         string   `json:"title"`
	Description   string   `json:"description"`
	ModifierSlots []string `json:"modifierSlots,omitempty"`
	Steps         []string `json:"steps,omitempty"`
}

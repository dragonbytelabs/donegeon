package project

import (
	"sync/atomic"
	"time"
)

var nextId atomic.Int64

type Project struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Color       string    `json:"color,omitempty"` // Hex color for UI
	Archived    bool      `json:"archived"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func getNextId() int {
	return int(nextId.Add(1))
}

func NewProject(name, description string) Project {
	id := getNextId()
	now := time.Now()
	return Project{
		ID:          id,
		Name:        name,
		Description: description,
		Archived:    false,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

func (p *Project) touch() {
	p.UpdatedAt = time.Now()
}

func (p *Project) Archive() {
	p.Archived = true
	p.touch()
}

func (p *Project) Unarchive() {
	p.Archived = false
	p.touch()
}

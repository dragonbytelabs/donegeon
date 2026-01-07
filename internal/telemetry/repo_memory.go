package telemetry

import (
	"encoding/json"
	"sync"
	"time"
)

// Repository stores telemetry events
type Repository interface {
	RecordEvent(eventType EventType, metadata EventMetadata) error
	GetEvents(since time.Time, eventTypes []EventType) ([]Event, error)
	Clear() error
}

// MemoryRepository stores events in memory (dev/test use)
type MemoryRepository struct {
	mu     sync.RWMutex
	events []Event
	nextID int
}

func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{
		events: make([]Event, 0),
		nextID: 1,
	}
}

func (r *MemoryRepository) RecordEvent(eventType EventType, metadata EventMetadata) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return err
	}

	event := Event{
		ID:        r.nextID,
		Type:      eventType,
		Timestamp: time.Now(),
		Metadata:  string(metadataJSON),
	}

	r.events = append(r.events, event)
	r.nextID++

	return nil
}

func (r *MemoryRepository) GetEvents(since time.Time, eventTypes []EventType) ([]Event, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	// Build a map for faster type lookup
	typeFilter := make(map[EventType]bool)
	for _, t := range eventTypes {
		typeFilter[t] = true
	}

	result := make([]Event, 0)
	for _, event := range r.events {
		// Filter by time
		if event.Timestamp.Before(since) {
			continue
		}

		// Filter by type (if specified)
		if len(eventTypes) > 0 && !typeFilter[event.Type] {
			continue
		}

		result = append(result, event)
	}

	return result, nil
}

func (r *MemoryRepository) Clear() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.events = make([]Event, 0)
	r.nextID = 1

	return nil
}

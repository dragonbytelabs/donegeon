package model

import (
	"fmt"
	"sync/atomic"
)

// Pan represents the board's pan offset.
type Pan struct {
	X int `json:"x"`
	Y int `json:"y"`
}

// BoardState holds the complete state of the board.
type BoardState struct {
	Stacks map[StackID]*Stack `json:"stacks"`
	Cards  map[CardID]*Card   `json:"cards"`
	NextZ  int                `json:"nextZ"`
	Pan    Pan                `json:"pan"`

	// ID counters for generating unique IDs
	stackCounter uint64
	cardCounter  uint64
}

// NewBoardState creates a new empty board state.
func NewBoardState() *BoardState {
	return &BoardState{
		Stacks: make(map[StackID]*Stack),
		Cards:  make(map[CardID]*Card),
		NextZ:  10,
		Pan:    Pan{X: 0, Y: 0},
	}
}

// generateStackID creates a new unique stack ID.
func (b *BoardState) generateStackID() StackID {
	n := atomic.AddUint64(&b.stackCounter, 1)
	return StackID(fmt.Sprintf("stack_%d", n))
}

// generateCardID creates a new unique card ID.
func (b *BoardState) generateCardID() CardID {
	n := atomic.AddUint64(&b.cardCounter, 1)
	return CardID(fmt.Sprintf("card_%d", n))
}

// nextZValue increments and returns the next Z value.
func (b *BoardState) nextZValue() int {
	b.NextZ++
	return b.NextZ
}

// GetStack returns a stack by ID, or nil if not found.
func (b *BoardState) GetStack(id StackID) *Stack {
	return b.Stacks[id]
}

// GetCard returns a card by ID, or nil if not found.
func (b *BoardState) GetCard(id CardID) *Card {
	return b.Cards[id]
}

// AddStack adds an existing stack to the board.
// Returns error if stack ID already exists.
func (b *BoardState) AddStack(s *Stack) error {
	if s == nil {
		return fmt.Errorf("cannot add nil stack")
	}
	if _, exists := b.Stacks[s.ID]; exists {
		return fmt.Errorf("duplicate stack id: %s", s.ID)
	}
	b.Stacks[s.ID] = s
	return nil
}

// AddCard adds a card to the board's card registry.
// Returns error if card ID already exists.
func (b *BoardState) AddCard(c *Card) error {
	if c == nil {
		return fmt.Errorf("cannot add nil card")
	}
	if _, exists := b.Cards[c.ID]; exists {
		return fmt.Errorf("duplicate card id: %s", c.ID)
	}
	b.Cards[c.ID] = c
	return nil
}

// RemoveStack removes a stack from the board.
// Soft failure: no-op if stack doesn't exist.
func (b *BoardState) RemoveStack(id StackID) {
	delete(b.Stacks, id)
}

// RemoveCard removes a card from the board's card registry.
// Soft failure: no-op if card doesn't exist.
func (b *BoardState) RemoveCard(id CardID) {
	delete(b.Cards, id)
}

// CreateStack creates a new stack with the given position and cards.
// Cards must already be registered in the board's Cards map.
func (b *BoardState) CreateStack(pos Point, cardIDs []CardID) *Stack {
	id := b.generateStackID()
	s := NewStack(id, pos, cardIDs)
	s.Z = b.nextZValue()
	b.Stacks[id] = s
	return s
}

// CreateCard creates a new card and registers it with the board.
func (b *BoardState) CreateCard(defID CardDefID, data map[string]any) *Card {
	id := b.generateCardID()
	c := NewCard(id, defID, data)
	b.Cards[id] = c
	return c
}

// BringToFront updates the stack's Z to be on top.
// Soft failure: no-op if stack doesn't exist.
func (b *BoardState) BringToFront(stackID StackID) {
	s := b.Stacks[stackID]
	if s == nil {
		return
	}
	s.Z = b.nextZValue()
}

// MoveStack updates a stack's position.
// Soft failure: no-op if stack doesn't exist.
func (b *BoardState) MoveStack(stackID StackID, pos Point) {
	s := b.Stacks[stackID]
	if s == nil {
		return
	}
	s.Pos = pos
}

// SplitStack splits a stack at the given index.
// Original stack keeps [0..index), new stack gets [index..end].
// Returns the new stack, or nil on soft failure.
func (b *BoardState) SplitStack(stackID StackID, index int, offset Point) *Stack {
	s := b.Stacks[stackID]
	if s == nil {
		return nil
	}

	pulled := s.SplitFrom(index)
	if pulled == nil {
		return nil
	}

	newPos := Point{X: s.Pos.X + offset.X, Y: s.Pos.Y + offset.Y}
	ns := b.CreateStack(newPos, pulled)

	return ns
}

// MergeStacks merges source stack into target stack, then removes source.
// Source cards go on top of target cards.
// Soft failure: no-op if stacks don't exist or are the same.
func (b *BoardState) MergeStacks(targetID, sourceID StackID) {
	if targetID == sourceID {
		return
	}

	target := b.Stacks[targetID]
	source := b.Stacks[sourceID]
	if target == nil || source == nil {
		return
	}

	target.MergeFrom(source)
	b.RemoveStack(sourceID)
	b.BringToFront(targetID)
}

// Unstack removes a stack and creates N single-card stacks.
// Returns the created stacks, or empty slice on soft failure.
func (b *BoardState) Unstack(stackID StackID, positions []Point) []*Stack {
	s := b.Stacks[stackID]
	if s == nil {
		return []*Stack{}
	}

	bundles := s.UnstackIntoSingles()
	if len(bundles) <= 1 {
		return []*Stack{}
	}

	b.RemoveStack(stackID)

	created := make([]*Stack, 0, len(bundles))
	for i, cards := range bundles {
		pos := s.Pos
		if i < len(positions) {
			pos = positions[i]
		}
		ns := b.CreateStack(pos, cards)
		created = append(created, ns)
	}

	return created
}

// PopBottom removes the bottom card from a stack and creates a new single-card stack.
// Returns the new stack, or nil on soft failure.
// If the original stack becomes empty, it is removed.
func (b *BoardState) PopBottom(stackID StackID, offset Point) *Stack {
	s := b.Stacks[stackID]
	if s == nil {
		return nil
	}

	cardID := s.TakeBottom()
	if cardID == "" {
		return nil
	}

	newPos := Point{X: s.Pos.X + offset.X, Y: s.Pos.Y + offset.Y}
	ns := b.CreateStack(newPos, []CardID{cardID})

	if s.Size() == 0 {
		b.RemoveStack(stackID)
	}

	return ns
}

// StackIDs returns all stack IDs in the board.
func (b *BoardState) StackIDs() []StackID {
	ids := make([]StackID, 0, len(b.Stacks))
	for id := range b.Stacks {
		ids = append(ids, id)
	}
	return ids
}

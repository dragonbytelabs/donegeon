package model

// StackID is a unique identifier for a stack.
type StackID string

// Point represents a 2D position.
type Point struct {
	X int `json:"x"`
	Y int `json:"y"`
}

// Stack is a collection of cards at a position on the board.
// Cards are ordered bottom-to-top (index 0 is bottom, last index is top).
type Stack struct {
	ID    StackID  `json:"id"`
	Pos   Point    `json:"pos"`
	Z     int      `json:"z"`
	Cards []CardID `json:"cards"`
}

// NewStack creates a new stack with the given ID and position.
func NewStack(id StackID, pos Point, cards []CardID) *Stack {
	if cards == nil {
		cards = []CardID{}
	}
	return &Stack{
		ID:    id,
		Pos:   pos,
		Z:     1,
		Cards: cards,
	}
}

// Size returns the number of cards in the stack.
func (s *Stack) Size() int {
	return len(s.Cards)
}

// TopIndex returns the index of the top card, or -1 if empty.
func (s *Stack) TopIndex() int {
	return len(s.Cards) - 1
}

// TopCard returns the ID of the top card, or empty string if empty.
func (s *Stack) TopCard() CardID {
	if len(s.Cards) == 0 {
		return ""
	}
	return s.Cards[len(s.Cards)-1]
}

// BottomCard returns the ID of the bottom card, or empty string if empty.
func (s *Stack) BottomCard() CardID {
	if len(s.Cards) == 0 {
		return ""
	}
	return s.Cards[0]
}

// IsStacked returns true if the stack has more than one card.
func (s *Stack) IsStacked() bool {
	return len(s.Cards) > 1
}

// TakeTop removes and returns the top card. Returns empty string if empty (soft failure).
func (s *Stack) TakeTop() CardID {
	if len(s.Cards) == 0 {
		return ""
	}
	top := s.Cards[len(s.Cards)-1]
	s.Cards = s.Cards[:len(s.Cards)-1]
	return top
}

// TakeBottom removes and returns the bottom card. Returns empty string if empty (soft failure).
func (s *Stack) TakeBottom() CardID {
	if len(s.Cards) == 0 {
		return ""
	}
	bottom := s.Cards[0]
	s.Cards = s.Cards[1:]
	return bottom
}

// TakeRange removes and returns cards in range [start, endExclusive).
// Returns nil if out of bounds or invalid range (soft failure).
func (s *Stack) TakeRange(start, endExclusive int) []CardID {
	if start < 0 || endExclusive > len(s.Cards) || start >= endExclusive {
		return nil
	}

	taken := make([]CardID, endExclusive-start)
	copy(taken, s.Cards[start:endExclusive])

	// Remove the range from cards
	s.Cards = append(s.Cards[:start], s.Cards[endExclusive:]...)

	return taken
}

// SplitFrom splits the stack at index, keeping [0..index) and returning [index..end].
// Returns nil if index out of range (soft failure).
// Example: [A,B,C,D,E], index=2 => stack becomes [A,B], returns [C,D,E]
func (s *Stack) SplitFrom(index int) []CardID {
	if index <= 0 || index >= len(s.Cards) {
		return nil
	}

	pulled := make([]CardID, len(s.Cards)-index)
	copy(pulled, s.Cards[index:])

	s.Cards = s.Cards[:index]

	return pulled
}

// MergeFrom appends all cards from another stack onto this stack.
// The other stack's cards go on top. No-op if other is empty.
func (s *Stack) MergeFrom(other *Stack) {
	if other == nil || len(other.Cards) == 0 {
		return
	}
	s.Cards = append(s.Cards, other.Cards...)
}

// UnstackIntoSingles returns each card as a separate slice (for creating individual stacks).
// Returns a slice of single-card slices.
func (s *Stack) UnstackIntoSingles() [][]CardID {
	if len(s.Cards) <= 1 {
		return [][]CardID{append([]CardID{}, s.Cards...)}
	}

	result := make([][]CardID, len(s.Cards))
	for i, card := range s.Cards {
		result[i] = []CardID{card}
	}
	return result
}

// SetCards replaces the card list.
func (s *Stack) SetCards(cards []CardID) {
	if cards == nil {
		cards = []CardID{}
	}
	s.Cards = cards
}

package model

// CardID is a unique identifier for a card instance.
type CardID string

// CardDefID is a stable identifier for a card definition (e.g. "deck.first_day", "villager.basic").
type CardDefID string

// CardKind represents the type of card (e.g. "task", "villager", "modifier", "deck", "loot").
type CardKind string

// CardDef is the template/definition for a card type.
// Loaded from config, not stored per-instance.
type CardDef struct {
	ID         CardDefID `json:"id"`
	Kind       CardKind  `json:"kind"`
	Title      string    `json:"title"`
	Icon       string    `json:"icon"`
	Skin       string    `json:"skin"`
	LeftBadge  string    `json:"leftBadge,omitempty"`
	RightBadge string    `json:"rightBadge,omitempty"`
}

// Card is an instance of a card on the board.
type Card struct {
	ID    CardID         `json:"id"`
	DefID CardDefID      `json:"defId"`
	Data  map[string]any `json:"data,omitempty"`
}

// NewCard creates a new card instance with the given ID and definition.
func NewCard(id CardID, defID CardDefID, data map[string]any) *Card {
	if data == nil {
		data = make(map[string]any)
	}
	return &Card{
		ID:    id,
		DefID: defID,
		Data:  data,
	}
}

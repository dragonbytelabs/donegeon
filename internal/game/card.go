package game

import (
	"context"
	"time"
)

// CardType represents the type of card in the game
type CardType string

const (
	CardTypeTask     CardType = "task"
	CardTypeVillager CardType = "villager"
	CardTypeModifier CardType = "modifier"
	CardTypeZombie   CardType = "zombie"
	CardTypeBuilding CardType = "building"
	CardTypeResource CardType = "resource"
	CardTypeFood     CardType = "food"
	CardTypeLoot     CardType = "loot"
)

// CardZone represents where a card is located
type CardZone string

const (
	CardZoneBoard   CardZone = "board"
	CardZoneHand    CardZone = "hand"
	CardZoneDeck    CardZone = "deck"
	CardZoneDiscard CardZone = "discard"
)

// Card represents a game card with position and state
type Card struct {
	ID         string    `json:"id"`
	Type       CardType  `json:"type"`
	Zone       CardZone  `json:"zone"`
	X          float64   `json:"x"`
	Y          float64   `json:"y"`
	ZIndex     int       `json:"z_index"`
	ParentID   *string   `json:"parent_id,omitempty"`   // For stacking cards
	TaskID     *int      `json:"task_id,omitempty"`     // Link to task entity
	VillagerID *string   `json:"villager_id,omitempty"` // Link to villager entity
	ModifierID *string   `json:"modifier_id,omitempty"` // Link to modifier entity
	ZombieID   *string   `json:"zombie_id,omitempty"`   // Link to zombie entity
	BuildingID *int      `json:"building_id,omitempty"` // Link to building entity
	Charges    *int      `json:"charges,omitempty"`     // For consumable cards
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// CardRepository handles persistence of game cards
type CardRepository interface {
	Get(ctx context.Context, id string) (*Card, error)
	List(ctx context.Context) ([]*Card, error)
	ListByZone(ctx context.Context, zone CardZone) ([]*Card, error)
	ListByType(ctx context.Context, cardType CardType) ([]*Card, error)
	Create(ctx context.Context, card *Card) error
	Update(ctx context.Context, card *Card) error
	Delete(ctx context.Context, id string) error
	DeleteMany(ctx context.Context, ids []string) error
}

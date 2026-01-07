package deck

import (
	"math/rand"
	"time"

	"donegeon/internal/loot"
	"donegeon/internal/modifier"
)

type Type string

const (
	TypeFirstDay     Type = "first_day"
	TypeOrganization Type = "organization"
	TypeMaintenance  Type = "maintenance"
	TypePlanning     Type = "planning"
	TypeIntegration  Type = "integration"
)

type Status string

const (
	StatusLocked   Status = "locked"
	StatusUnlocked Status = "unlocked"
)

type Deck struct {
	ID          string `json:"id"`
	Type        Type   `json:"type"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Status      Status `json:"status"`
	BaseCost    int    `json:"base_cost"`
	TimesOpened int    `json:"times_opened"`
}

type CardDrop struct {
	Type         string         `json:"type"`
	ModifierType string         `json:"modifier_type,omitempty"`
	ModifierCard *modifier.Card `json:"modifier_card,omitempty"`
	LootType     string         `json:"loot_type,omitempty"`
	LootAmount   int            `json:"loot_amount,omitempty"`
	VillagerID   string         `json:"villager_id,omitempty"`
	ResourceCard *ResourceCard  `json:"resource_card,omitempty"`
}

type ResourceCard struct {
	ResourceType   string `json:"resource_type"`
	Charges        int    `json:"charges"`
	MaxCharges     int    `json:"max_charges"`
	GatherTime     int    `json:"gather_time"`     // seconds to gather one unit
	Produces       string `json:"produces"`        // food_type produced
	StaminaRestore int    `json:"stamina_restore"` // stamina restored by food
}

type OpenResult struct {
	DeckID   string     `json:"deck_id"`
	Drops    []CardDrop `json:"drops"`
	CostPaid int        `json:"cost_paid"`
}

type Definition struct {
	Type        Type
	Name        string
	Description string
	BaseCost    int
	Contents    []ContentEntry
}

type ContentEntry struct {
	Type                   string
	Weight                 int
	ModifierType           modifier.Type
	ModifierCharges        int
	LootType               loot.Type
	LootAmount             int
	ResourceType           string
	ResourceCharges        int
	ResourceGatherTime     int
	ResourceProduces       string
	ResourceStaminaRestore int
}

var Definitions = map[Type]Definition{
	TypeFirstDay: {
		Type:        TypeFirstDay,
		Name:        "First Day Deck",
		Description: "Bootstrap deck",
		BaseCost:    0,
		Contents: []ContentEntry{
			{Type: "blank_task", Weight: 30},                               // Reduced from 60
			{Type: "loot", Weight: 25, LootType: loot.Coin, LootAmount: 2}, // Reduced amount and weight
			{Type: "loot", Weight: 15, LootType: loot.Paper, LootAmount: 1},
			{Type: "resource", Weight: 15, ResourceType: "berry_bush", ResourceCharges: 3, ResourceGatherTime: 3, ResourceProduces: "berries", ResourceStaminaRestore: 1}, // Increased from 1
			{Type: "modifier", Weight: 10, ModifierType: modifier.NextAction, ModifierCharges: 3},                                                                         // New: Next Action
			{Type: "modifier", Weight: 5, ModifierType: modifier.Checklist, ModifierCharges: 2},                                                                           // New: Checklist
		},
	},
	TypeOrganization: {
		Type:        TypeOrganization,
		Name:        "Organization Deck",
		Description: "Workflow modifiers",
		BaseCost:    2,
		Contents: []ContentEntry{
			{Type: "modifier", Weight: 25, ModifierType: modifier.NextAction, ModifierCharges: 4},    // New: GTD next action
			{Type: "modifier", Weight: 25, ModifierType: modifier.ReviewCadence, ModifierCharges: 3}, // New: Regular reviews
			{Type: "modifier", Weight: 20, ModifierType: modifier.Checklist, ModifierCharges: 3},     // New: Break down tasks
			{Type: "modifier", Weight: 15, ModifierType: modifier.RecurringContract, ModifierCharges: 4},
			{Type: "modifier", Weight: 10, ModifierType: modifier.ImportanceSeal, ModifierCharges: 3},
			{Type: "blank_task", Weight: 5},
		},
	},
	TypeMaintenance: {
		Type:        TypeMaintenance,
		Name:        "Maintenance Deck",
		Description: "Upkeep tools",
		BaseCost:    3,
		Contents: []ContentEntry{
			{Type: "modifier", Weight: 30, ModifierType: modifier.RecurringContract, ModifierCharges: 4},
			{Type: "modifier", Weight: 25, ModifierType: modifier.WaitingOn, ModifierCharges: 2},     // New: Blocking tasks
			{Type: "modifier", Weight: 20, ModifierType: modifier.ReviewCadence, ModifierCharges: 3}, // New: Regular reviews
			{Type: "modifier", Weight: 15, ModifierType: modifier.DeadlinePin, ModifierCharges: 0},
			{Type: "loot", Weight: 5, LootType: loot.Gear, LootAmount: 2},
			{Type: "blank_task", Weight: 5},
		},
	},
	TypePlanning: {
		Type:        TypePlanning,
		Name:        "Planning Deck",
		Description: "Progress materials",
		BaseCost:    4,
		Contents: []ContentEntry{
			{Type: "modifier", Weight: 30, ModifierType: modifier.NextAction, ModifierCharges: 5}, // New: Lots of next actions
			{Type: "modifier", Weight: 25, ModifierType: modifier.Checklist, ModifierCharges: 4},  // New: Project breakdowns
			{Type: "modifier", Weight: 20, ModifierType: modifier.ScheduleToken, ModifierCharges: 2},
			{Type: "loot", Weight: 15, LootType: loot.BlueprintShard, LootAmount: 1},
			{Type: "loot", Weight: 10, LootType: loot.Paper, LootAmount: 3},
		},
	},
	TypeIntegration: {
		Type:        TypeIntegration,
		Name:        "Integration Deck",
		Description: "Advanced materials",
		BaseCost:    6,
		Contents: []ContentEntry{
			{Type: "loot", Weight: 35, LootType: loot.Parts, LootAmount: 3},
			{Type: "loot", Weight: 25, LootType: loot.BlueprintShard, LootAmount: 2},
			{Type: "loot", Weight: 20, LootType: loot.Gear, LootAmount: 3},
			{Type: "loot", Weight: 15, LootType: loot.Ink, LootAmount: 2},
			{Type: "loot", Weight: 5, LootType: loot.Coin, LootAmount: 10},
		},
	},
}

func (d *Definition) Open() []CardDrop {
	rand.Seed(time.Now().UnixNano())

	totalWeight := 0
	for _, entry := range d.Contents {
		totalWeight += entry.Weight
	}

	if totalWeight == 0 {
		return []CardDrop{}
	}

	numCards := 3 + rand.Intn(3)
	drops := make([]CardDrop, 0, numCards)

	for i := 0; i < numCards; i++ {
		roll := rand.Intn(totalWeight)
		current := 0

		for _, entry := range d.Contents {
			current += entry.Weight
			if roll < current {
				drop := CardDrop{Type: entry.Type}

				switch entry.Type {
				case "modifier":
					drop.ModifierType = string(entry.ModifierType)
					drop.ModifierCard = &modifier.Card{
						Type:       entry.ModifierType,
						MaxCharges: entry.ModifierCharges,
						Charges:    entry.ModifierCharges,
						Status:     modifier.StatusActive,
						CreatedAt:  time.Now(),
					}
				case "resource":
					drop.ResourceCard = &ResourceCard{
						ResourceType:   entry.ResourceType,
						Charges:        entry.ResourceCharges,
						MaxCharges:     entry.ResourceCharges,
						GatherTime:     entry.ResourceGatherTime,
						Produces:       entry.ResourceProduces,
						StaminaRestore: entry.ResourceStaminaRestore,
					}
				case "loot":
					drop.LootType = string(entry.LootType)
					drop.LootAmount = entry.LootAmount
				case "villager":
					drop.VillagerID = "new_villager"
				case "blank_task":
					// Blank task card - no additional data needed
					// Frontend will create a placeholder task card
				}

				drops = append(drops, drop)
				break
			}
		}
	}

	return drops
}

func (d *Deck) GetCost(packCostPct int) int {
	cost := d.BaseCost

	if d.Type == TypeFirstDay && d.TimesOpened < 5 {
		return 0
	}

	if d.Type == TypeFirstDay {
		cost = 1
	}

	if packCostPct > 0 {
		penalty := (cost * packCostPct) / 100
		cost += penalty
	}

	return cost
}

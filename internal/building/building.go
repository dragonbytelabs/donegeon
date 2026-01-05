package building

import "donegeon/internal/loot"

type Type string

const (
	TypeProjectBoard    Type = "project_board"
	TypeRestHall        Type = "rest_hall"
	TypeCalendarConsole Type = "calendar_console"
	TypeRoutineFarm     Type = "routine_farm"
	TypeAutomationForge Type = "automation_forge"
)

type Status string

const (
	StatusLocked Status = "locked"
	StatusBuilt  Status = "built"
)

type Building struct {
	ID          string `json:"id"`
	Type        Type   `json:"type"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Effect      string `json:"effect"`
	Status      Status `json:"status"`
}

type Recipe struct {
	Type        Type
	Name        string
	Description string
	Effect      string
	Cost        []loot.Drop
}

var Recipes = map[Type]Recipe{
	TypeProjectBoard: {
		Type:        TypeProjectBoard,
		Name:        "Project Board",
		Description: "Organize tasks into project zones",
		Effect:      "Projects become true zones",
		Cost: []loot.Drop{
			{Type: loot.Paper, Amount: 2},
			{Type: loot.Coin, Amount: 5},
		},
	},
	TypeRestHall: {
		Type:        TypeRestHall,
		Name:        "Rest Hall",
		Description: "Villager recovery",
		Effect:      "+1 stamina to all villagers",
		Cost: []loot.Drop{
			{Type: loot.Gear, Amount: 2},
			{Type: loot.Paper, Amount: 1},
			{Type: loot.Coin, Amount: 5},
		},
	},
	TypeCalendarConsole: {
		Type:        TypeCalendarConsole,
		Name:        "Calendar Console",
		Description: "Advanced scheduling",
		Effect:      "No schedule token costs",
		Cost: []loot.Drop{
			{Type: loot.Parts, Amount: 3},
			{Type: loot.Paper, Amount: 2},
			{Type: loot.Coin, Amount: 15},
		},
	},
	TypeRoutineFarm: {
		Type:        TypeRoutineFarm,
		Name:        "Routine Farm",
		Description: "Automate recurring tasks",
		Effect:      "Auto-execute recurring tasks (70% loot)",
		Cost: []loot.Drop{
			{Type: loot.BlueprintShard, Amount: 3},
			{Type: loot.Paper, Amount: 2},
			{Type: loot.Coin, Amount: 10},
		},
	},
	TypeAutomationForge: {
		Type:        TypeAutomationForge,
		Name:        "Automation Forge",
		Description: "Build automation rules",
		Effect:      "Unlock automation rules",
		Cost: []loot.Drop{
			{Type: loot.Parts, Amount: 5},
			{Type: loot.BlueprintShard, Amount: 3},
			{Type: loot.Coin, Amount: 20},
		},
	},
}

func (r Recipe) CanBuild(inv loot.Inventory) bool {
	for _, cost := range r.Cost {
		if !inv.Has(cost.Type, cost.Amount) {
			return false
		}
	}
	return true
}

func (r Recipe) SpendCost(inv *loot.Inventory) bool {
	if !r.CanBuild(*inv) {
		return false
	}

	for _, cost := range r.Cost {
		if !inv.Spend(cost.Type, cost.Amount) {
			return false
		}
	}

	return true
}

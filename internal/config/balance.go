package config

// Balance holds gameplay balance configuration
type Balance struct {
	// Zombie spawn rules
	MaxZombiesPerDay        int `json:"max_zombies_per_day"`
	ImportantIgnoreDays     int `json:"important_ignore_days"`
	ImportantIgnoreDaysFast int `json:"important_ignore_days_fast"`

	// Zombie penalties
	LootPenaltyPerZombie int `json:"loot_penalty_per_zombie"`
	MaxLootPenalty       int `json:"max_loot_penalty"`
	PackCostPerZombie    int `json:"pack_cost_per_zombie"`
	MaxPackCost          int `json:"max_pack_cost"`
	OverrunThreshold     int `json:"overrun_threshold"`
	TiredThreshold       int `json:"tired_threshold"`

	// Villager stats
	DefaultMaxStamina   int `json:"default_max_stamina"`
	StaminaPerTaskLevel int `json:"stamina_per_task_level"`
	TasksForLevel2      int `json:"tasks_for_level_2"`

	// Deck costs
	FirstDayDeckCost     int `json:"first_day_deck_cost"`
	OrganizationDeckCost int `json:"organization_deck_cost"`
	MaintenanceDeckCost  int `json:"maintenance_deck_cost"`
	PlanningDeckCost     int `json:"planning_deck_cost"`
	IntegrationDeckCost  int `json:"integration_deck_cost"`

	// Combat
	ZombieClearStamina int `json:"zombie_clear_stamina"`

	// Recycling
	BlankTaskRecycleCoins int `json:"blank_task_recycle_coins"`
}

// Default returns the default balance configuration
func Default() Balance {
	return Balance{
		MaxZombiesPerDay:        5,
		ImportantIgnoreDays:     2,
		ImportantIgnoreDaysFast: 1,
		LootPenaltyPerZombie:    10,
		MaxLootPenalty:          50,
		PackCostPerZombie:       15,
		MaxPackCost:             100,
		OverrunThreshold:        5,
		TiredThreshold:          4,
		DefaultMaxStamina:       10,
		StaminaPerTaskLevel:     2,
		TasksForLevel2:          2,
		FirstDayDeckCost:        0,
		OrganizationDeckCost:    2,
		MaintenanceDeckCost:     3,
		PlanningDeckCost:        4,
		IntegrationDeckCost:     6,
		ZombieClearStamina:      2,
		BlankTaskRecycleCoins:   1,
	}
}

// Casual returns easier balance for casual difficulty
func Casual() Balance {
	cfg := Default()
	cfg.MaxZombiesPerDay = 3
	cfg.ImportantIgnoreDays = 3
	cfg.LootPenaltyPerZombie = 5
	cfg.PackCostPerZombie = 10
	cfg.TiredThreshold = 5
	cfg.DefaultMaxStamina = 12
	return cfg
}

// Hard returns harder balance for experienced players
func Hard() Balance {
	cfg := Default()
	cfg.MaxZombiesPerDay = 7
	cfg.ImportantIgnoreDays = 1
	cfg.ImportantIgnoreDaysFast = 1
	cfg.LootPenaltyPerZombie = 15
	cfg.PackCostPerZombie = 20
	cfg.TiredThreshold = 3
	cfg.OverrunThreshold = 4
	return cfg
}

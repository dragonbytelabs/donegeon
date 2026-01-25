package donegeon

type Config struct {
	Version             string              `yaml:"version"`
	UI                  UIConfig            `yaml:"ui"`
	SeededRNG           SeededRNG           `yaml:"seeded_rng"`
	World               WorldConfig         `yaml:"world"`
	Villagers           Villagers           `yaml:"villagers"`
	Tasks               Tasks               `yaml:"tasks"`
	Modifiers           Modifiers           `yaml:"modifiers"`
	Resources           Resources           `yaml:"resources"`
	Food                Food                `yaml:"food"`
	Loot                Loot                `yaml:"loot"`
	TaskCompletionDrops TaskCompletionDrops `yaml:"task_completion_drops"`
	Decks               Decks               `yaml:"decks"`
	Zombies             Zombies             `yaml:"zombies"`
	Salvage             Salvage             `yaml:"salvage"`
	Rules               Rules               `yaml:"rules"`
	UIHints             UIHints             `yaml:"ui_hints"`
}

type UIConfig struct {
	Board BoardUIConfig `yaml:"board"`
}

type SeededRNG struct {
	Enabled                bool `yaml:"enabled"`
	DeterministicDeckDraws bool `yaml:"deterministic_deck_draws"`
}

type WorldConfig struct {
	DayTick DayTick `yaml:"day_tick"`
}

type DayTick struct {
	MaxZombiesSpawnPerDay int             `yaml:"max_zombies_spawn_per_day"`
	StaminaReset          StaminaReset    `yaml:"stamina_reset"`
	OverdueRules          OverdueRules    `yaml:"overdue_rules"`
	RecurrenceRules       RecurrenceRules `yaml:"recurrence_rules"`
}

type StaminaReset struct {
	Enabled bool   `yaml:"enabled"`
	Mode    string `yaml:"mode"`
}

type OverdueRules struct {
	ZombieSpawn ZombieSpawn `yaml:"zombie_spawn"`
	Penalties   Penalties   `yaml:"penalties"`
}

type ZombieSpawn struct {
	Enabled        bool `yaml:"enabled"`
	PerOverdueTask int  `yaml:"per_overdue_task"`
	CapPerDay      int  `yaml:"cap_per_day"`
}

type Penalties struct {
	DeckCostMultiplierPerZombie float64 `yaml:"deck_cost_multiplier_per_zombie"`
	VillagerFatiguePerZombie    int     `yaml:"villager_fatigue_per_zombie"`
}

type RecurrenceRules struct {
	ConsumeModifierCharges bool `yaml:"consume_modifier_charges"`
	SpawnIfDue             bool `yaml:"spawn_if_due"`
}

type Villagers struct {
	Defaults VillagerDefaults `yaml:"defaults"`
	Leveling Leveling         `yaml:"leveling"`
	Actions  VillagerActions  `yaml:"actions"`
}

type VillagerDefaults struct {
	MaxLevel       int           `yaml:"max_level"`
	BaseMaxStamina int           `yaml:"base_max_stamina"`
	BaseSpeed      float64       `yaml:"base_speed"`
	Tired          VillagerTired `yaml:"tired"`
}

type VillagerTired struct {
	Enabled  bool         `yaml:"enabled"`
	Trigger  TiredTrigger `yaml:"trigger"`
	Duration int          `yaml:"duration_days"`
	Effects  TiredEffects `yaml:"effects"`
}

type TiredTrigger struct {
	OverrunLevelGTE int `yaml:"overrun_level_gte"`
}

type TiredEffects struct {
	StaminaMultiplier float64 `yaml:"stamina_multiplier"`
	SpeedMultiplier   float64 `yaml:"speed_multiplier"`
}

type Leveling struct {
	XPSources       XPSources   `yaml:"xp_sources"`
	Thresholds      map[int]int `yaml:"thresholds"`
	ChoicesPerLevel int         `yaml:"choices_per_level"`
	PerkPool        []Perk      `yaml:"perk_pool"`
}

type XPSources struct {
	CompleteTask        CompleteTaskXP `yaml:"complete_task"`
	ClearZombie         BaseXP         `yaml:"clear_zombie"`
	GatherResourceCycle BaseXP         `yaml:"gather_resource_cycle"`
}

type CompleteTaskXP struct {
	BaseXP     int            `yaml:"base_xp"`
	ByPriority map[string]int `yaml:"by_priority"`
}

type BaseXP struct {
	BaseXP int `yaml:"base_xp"`
}

type Perk struct {
	ID    string      `yaml:"id"`
	Label string      `yaml:"label"`
	Apply interface{} `yaml:"apply"` // You may want to define a struct for all possible apply fields
}

type VillagerActions struct {
	AssignTask  ActionCost        `yaml:"assign_task"`
	WorkTask    ActionCost        `yaml:"work_task"`
	ClearZombie ClearZombieAction `yaml:"clear_zombie"`
	GatherStart ActionCost        `yaml:"gather_start"`
	EatFood     ActionCost        `yaml:"eat_food"`
}

type ActionCost struct {
	StaminaCost int `yaml:"stamina_cost"`
}

type ClearZombieAction struct {
	StaminaCost       int `yaml:"stamina_cost"`
	MinCostAfterPerks int `yaml:"min_cost_after_perks"`
}

type Tasks struct {
	Priorities TaskPriorities `yaml:"priorities"`
	Zones      TaskZones      `yaml:"zones"`
	DueDate    TaskDueDate    `yaml:"due_date"`
	Recurrence TaskRecurrence `yaml:"recurrence"`
	Processing TaskProcessing `yaml:"processing"`
}

type TaskPriorities struct {
	Levels              []string           `yaml:"levels"`
	LootBonusByPriority map[string]float64 `yaml:"loot_bonus_by_priority"`
}

type TaskZones struct {
	Allowed     []string `yaml:"allowed"`
	DefaultZone string   `yaml:"default_zone"`
}

type TaskDueDate struct {
	GraceHours int `yaml:"grace_hours"`
}

type TaskRecurrence struct {
	Supported                   []string `yaml:"supported"`
	DefaultOnCompleteReschedule bool     `yaml:"default_on_complete_reschedule"`
}

type TaskProcessing struct {
	WorkedTodayMarksProgress           bool `yaml:"worked_today_marks_progress"`
	CompletionRequiresAssignedVillager bool `yaml:"completion_requires_assigned_villager"`
}

type Modifiers struct {
	GlobalRules GlobalModifierRules `yaml:"global_rules"`
	Types       []ModifierType      `yaml:"types"`
}

type GlobalModifierRules struct {
	MaxModifiersPerTask    int      `yaml:"max_modifiers_per_task"`
	AllowDuplicateTypes    bool     `yaml:"allow_duplicate_types"`
	DuplicateTypeAllowlist []string `yaml:"duplicate_type_allowlist"`
}

type ModifierType struct {
	ID         string                 `yaml:"id"`
	Label      string                 `yaml:"label"`
	Category   string                 `yaml:"category"`
	StackRules ModifierStackRules     `yaml:"stack_rules"`
	Charges    ModifierCharges        `yaml:"charges"`
	Effects    map[string]interface{} `yaml:"effects"` // You may want to define a struct for all possible effects
}

type ModifierStackRules struct {
	AttachTo      []string `yaml:"attach_to"`
	UniquePerTask bool     `yaml:"unique_per_task"`
	UniqueGlobal  bool     `yaml:"unique_global"`
}

type ModifierCharges struct {
	Mode          string   `yaml:"mode"`
	MaxCharges    int      `yaml:"max_charges"`
	ConsumeOn     []string `yaml:"consume_on"`
	SpentBehavior string   `yaml:"spent_behavior"`
}

type Resources struct {
	Nodes []ResourceNode `yaml:"nodes"`
}

type ResourceNode struct {
	ID      string          `yaml:"id"`
	Label   string          `yaml:"label"`
	Charges ResourceCharges `yaml:"charges"`
	Gather  ResourceGather  `yaml:"gather"`
}

type ResourceCharges struct {
	Min int `yaml:"min"`
	Max int `yaml:"max"`
}

type ResourceGather struct {
	BaseTimeS             int                 `yaml:"base_time_s"`
	TimeMultiplierByLevel map[int]float64     `yaml:"time_multiplier_by_level"`
	Produces              ResourceProduces    `yaml:"produces"`
	LootOnCycle           ResourceLootOnCycle `yaml:"loot_on_cycle"`
}

type ResourceProduces struct {
	Type   string `yaml:"type"`
	ID     string `yaml:"id"`
	Amount int    `yaml:"amount"`
}

type ResourceLootOnCycle struct {
	RNGPool []RNGPoolEntry `yaml:"rng_pool"`
}

type RNGPoolEntry struct {
	Type   string `yaml:"type"`
	ID     string `yaml:"id,omitempty"`
	Amount int    `yaml:"amount,omitempty"`
	Weight int    `yaml:"weight"`
}

type Food struct {
	Items []FoodItem `yaml:"items"`
}

type FoodItem struct {
	ID             string                 `yaml:"id"`
	Label          string                 `yaml:"label"`
	StaminaRestore int                    `yaml:"stamina_restore"`
	Effects        map[string]interface{} `yaml:"effects"` // You may want to define a struct for all possible effects
}

type Loot struct {
	Types map[string]LootType `yaml:"types"`
}

type LootType struct {
	Label     string `yaml:"label"`
	Stackable bool   `yaml:"stackable"`
}

type TaskCompletionDrops struct {
	Base       RNGPool                               `yaml:"base"`
	ByModifier map[string]TaskCompletionModifierDrop `yaml:"by_modifier"`
}

type RNGPool struct {
	RNGPool []RNGPoolEntry `yaml:"rng_pool"`
}

type TaskCompletionModifierDrop struct {
	AddPool []RNGPoolEntry `yaml:"add_pool"`
}

type Decks struct {
	Economy DeckEconomy `yaml:"economy"`
	List    []Deck      `yaml:"list"`
}

type DeckEconomy struct {
	BaseCostCurrency              string  `yaml:"base_cost_currency"`
	ZombieCostMultiplierPerZombie float64 `yaml:"zombie_cost_multiplier_per_zombie"`
	OverrunCostMultiplierPerLevel float64 `yaml:"overrun_cost_multiplier_per_level"`
}

type Deck struct {
	ID              string                 `yaml:"id"`
	Label           string                 `yaml:"label"`
	Type            string                 `yaml:"type"`
	Status          string                 `yaml:"status"`
	BaseCost        int                    `yaml:"base_cost"`
	FreeOpens       int                    `yaml:"free_opens"`
	Description     string                 `yaml:"description"`
	UnlockCondition map[string]interface{} `yaml:"unlock_condition"`
	Draws           DeckDraws              `yaml:"draws"`
}

type DeckDraws struct {
	Count   int            `yaml:"count"`
	RNGPool []DeckRNGEntry `yaml:"rng_pool"`
}

type DeckRNGEntry struct {
	CardType   string `yaml:"card_type"`
	VillagerID string `yaml:"villager_id,omitempty"`
	ModifierID string `yaml:"modifier_id,omitempty"`
	LootID     string `yaml:"loot_id,omitempty"`
	ResourceID string `yaml:"resource_id,omitempty"`
	FoodID     string `yaml:"food_id,omitempty"`
	Amount     int    `yaml:"amount,omitempty"`
	Weight     int    `yaml:"weight"`
}

type Zombies struct {
	Types []ZombieType `yaml:"types"`
}

type ZombieType struct {
	ID        string          `yaml:"id"`
	Label     string          `yaml:"label"`
	Behaviors ZombieBehaviors `yaml:"behaviors"`
	Cleanup   ZombieCleanup   `yaml:"cleanup"`
}

type ZombieBehaviors struct {
	DeckCostMultiplier float64       `yaml:"deck_cost_multiplier"`
	FatigueOnTick      FatigueOnTick `yaml:"fatigue_on_tick"`
}

type FatigueOnTick struct {
	Enabled          bool `yaml:"enabled"`
	StaminaReduction int  `yaml:"stamina_reduction"`
}

type ZombieCleanup struct {
	StaminaCost   int     `yaml:"stamina_cost"`
	RewardOnClear RNGPool `yaml:"reward_on_clear"`
}

type Salvage struct {
	Enabled             bool               `yaml:"enabled"`
	SpentModifierToLoot map[string]RNGPool `yaml:"spent_modifier_to_loot"`
}

type Rules struct {
	Stacking   StackingRules   `yaml:"stacking"`
	Uniqueness UniquenessRules `yaml:"uniqueness"`
}

type StackingRules struct {
	AllowedPairs [][]string `yaml:"allowed_pairs"`
	Disallowed   [][]string `yaml:"disallowed"`
}

type UniquenessRules struct {
	GlobalUniqueModifiers []string `yaml:"global_unique_modifiers"`
}

type UIHints struct {
	Highlights UIHighlights `yaml:"highlights"`
	Board      UIBoard      `yaml:"board"`
}

type UIHighlights struct {
	NextActionGlow  bool `yaml:"next_action_glow"`
	LegalStackGreen bool `yaml:"legal_stack_green"`
	IllegalStackRed bool `yaml:"illegal_stack_red"`
}

type UIBoard struct {
	DefaultSpawnLayout DefaultSpawnLayout `yaml:"default_spawn_layout"`
}

type DefaultSpawnLayout struct {
	Villagers UILayoutVillagers `yaml:"villagers"`
	Tasks     UILayoutTasks     `yaml:"tasks"`
	Zombies   UILayoutZombies   `yaml:"zombies"`
}

type UILayoutVillagers struct {
	StartX int `yaml:"start_x"`
	StartY int `yaml:"start_y"`
	DX     int `yaml:"dx"`
}

type UILayoutTasks struct {
	StartX   int `yaml:"start_x"`
	StartY   int `yaml:"start_y"`
	GridCols int `yaml:"grid_cols"`
	DX       int `yaml:"dx"`
	DY       int `yaml:"dy"`
}

type UILayoutZombies struct {
	StartX int `yaml:"start_x"`
	StartY int `yaml:"start_y"`
	DX     int `yaml:"dx"`
}

type BoardUIConfig struct {
	GridSize     int `yaml:"grid_size"`
	CardWidth    int `yaml:"card_width"`
	CardHeight   int `yaml:"card_height"`
	StackOffsetY int `yaml:"stack_offset_y"`
}

func (b *BoardUIConfig) ApplyDefaults() {
	if b.GridSize == 0 {
		b.GridSize = 20
	}
	if b.CardWidth == 0 {
		b.CardWidth = 92
	}
	if b.CardHeight == 0 {
		b.CardHeight = 124
	}
	if b.StackOffsetY == 0 {
		b.StackOffsetY = 20
	}
}

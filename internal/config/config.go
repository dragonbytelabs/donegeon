package config

import (
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Version             string              `yaml:"version" json:"version"`
	UI                  UIConfig            `yaml:"ui" json:"ui"`
	SeededRNG           SeededRNG           `yaml:"seeded_rng" json:"seeded_rng"`
	World               WorldConfig         `yaml:"world" json:"world"`
	Villagers           Villagers           `yaml:"villagers" json:"villagers"`
	Tasks               Tasks               `yaml:"tasks" json:"tasks"`
	Modifiers           Modifiers           `yaml:"modifiers" json:"modifiers"`
	Resources           Resources           `yaml:"resources" json:"resources"`
	Food                Food                `yaml:"food" json:"food"`
	Loot                Loot                `yaml:"loot" json:"loot"`
	TaskCompletionDrops TaskCompletionDrops `yaml:"task_completion_drops" json:"task_completion_drops"`
	Decks               Decks               `yaml:"decks" json:"decks"`
	Zombies             Zombies             `yaml:"zombies" json:"zombies"`
	Salvage             Salvage             `yaml:"salvage" json:"salvage"`
	Rules               Rules               `yaml:"rules" json:"rules"`
	UIHints             UIHints             `yaml:"ui_hints" json:"ui_hints"`
}

type UIConfig struct {
	Board BoardUIConfig `yaml:"board" json:"board"`
}

type SeededRNG struct {
	Enabled                bool `yaml:"enabled" json:"enabled"`
	DeterministicDeckDraws bool `yaml:"deterministic_deck_draws" json:"deterministic_deck_draws"`
}

type WorldConfig struct {
	DayTick DayTick `yaml:"day_tick" json:"day_tick"`
}

type DayTick struct {
	MaxZombiesSpawnPerDay int             `yaml:"max_zombies_spawn_per_day" json:"max_zombies_spawn_per_day"`
	StaminaReset          StaminaReset    `yaml:"stamina_reset" json:"stamina_reset"`
	OverdueRules          OverdueRules    `yaml:"overdue_rules" json:"overdue_rules"`
	RecurrenceRules       RecurrenceRules `yaml:"recurrence_rules" json:"recurrence_rules"`
}

type StaminaReset struct {
	Enabled bool   `yaml:"enabled" json:"enabled"`
	Mode    string `yaml:"mode" json:"mode"`
}

type OverdueRules struct {
	ZombieSpawn ZombieSpawn `yaml:"zombie_spawn" json:"zombie_spawn"`
	Penalties   Penalties   `yaml:"penalties" json:"penalties"`
}

type ZombieSpawn struct {
	Enabled        bool     `yaml:"enabled" json:"enabled"`
	PerOverdueTask int      `yaml:"per_overdue_task" json:"per_overdue_task"`
	CapPerDay      int      `yaml:"cap_per_day" json:"cap_per_day"`
	SpawnChance    *float64 `yaml:"spawn_chance" json:"spawn_chance,omitempty"`
}

type Penalties struct {
	DeckCostMultiplierPerZombie float64 `yaml:"deck_cost_multiplier_per_zombie" json:"deck_cost_multiplier_per_zombie"`
	VillagerFatiguePerZombie    int     `yaml:"villager_fatigue_per_zombie" json:"villager_fatigue_per_zombie"`
}

type RecurrenceRules struct {
	ConsumeModifierCharges bool `yaml:"consume_modifier_charges" json:"consume_modifier_charges"`
	SpawnIfDue             bool `yaml:"spawn_if_due" json:"spawn_if_due"`
}

type Villagers struct {
	Defaults VillagerDefaults `yaml:"defaults" json:"defaults"`
	Leveling Leveling         `yaml:"leveling" json:"leveling"`
	Actions  VillagerActions  `yaml:"actions" json:"actions"`
}

type VillagerDefaults struct {
	MaxLevel       int           `yaml:"max_level" json:"max_level"`
	BaseMaxStamina int           `yaml:"base_max_stamina" json:"base_max_stamina"`
	BaseSpeed      float64       `yaml:"base_speed" json:"base_speed"`
	Tired          VillagerTired `yaml:"tired" json:"tired"`
}

type VillagerTired struct {
	Enabled  bool         `yaml:"enabled" json:"enabled"`
	Trigger  TiredTrigger `yaml:"trigger" json:"trigger"`
	Duration int          `yaml:"duration_days" json:"duration_days"`
	Effects  TiredEffects `yaml:"effects" json:"effects"`
}

type TiredTrigger struct {
	OverrunLevelGTE int `yaml:"overrun_level_gte" json:"overrun_level_gte"`
}

type TiredEffects struct {
	StaminaMultiplier float64 `yaml:"stamina_multiplier" json:"stamina_multiplier"`
	SpeedMultiplier   float64 `yaml:"speed_multiplier" json:"speed_multiplier"`
}

type Leveling struct {
	XPSources       XPSources   `yaml:"xp_sources" json:"xp_sources"`
	Thresholds      map[int]int `yaml:"thresholds" json:"thresholds"`
	ChoicesPerLevel int         `yaml:"choices_per_level" json:"choices_per_level"`
	PerkPool        []Perk      `yaml:"perk_pool" json:"perk_pool"`
}

type XPSources struct {
	CompleteTask        CompleteTaskXP `yaml:"complete_task" json:"complete_task"`
	ClearZombie         BaseXP         `yaml:"clear_zombie" json:"clear_zombie"`
	GatherResourceCycle BaseXP         `yaml:"gather_resource_cycle" json:"gather_resource_cycle"`
}

type CompleteTaskXP struct {
	BaseXP     int            `yaml:"base_xp" json:"base_xp"`
	ByPriority map[string]int `yaml:"by_priority" json:"by_priority"`
}

type BaseXP struct {
	BaseXP int `yaml:"base_xp" json:"base_xp"`
}

type Perk struct {
	ID    string      `yaml:"id" json:"id"`
	Label string      `yaml:"label" json:"label"`
	Apply interface{} `yaml:"apply" json:"apply"`
}

type VillagerActions struct {
	AssignTask  ActionCost        `yaml:"assign_task" json:"assign_task"`
	WorkTask    ActionCost        `yaml:"work_task" json:"work_task"`
	ClearZombie ClearZombieAction `yaml:"clear_zombie" json:"clear_zombie"`
	GatherStart ActionCost        `yaml:"gather_start" json:"gather_start"`
	EatFood     ActionCost        `yaml:"eat_food" json:"eat_food"`
}

type ActionCost struct {
	StaminaCost int `yaml:"stamina_cost" json:"stamina_cost"`
}

type ClearZombieAction struct {
	StaminaCost       int `yaml:"stamina_cost" json:"stamina_cost"`
	MinCostAfterPerks int `yaml:"min_cost_after_perks" json:"min_cost_after_perks"`
}

type Tasks struct {
	Priorities TaskPriorities `yaml:"priorities" json:"priorities"`
	Zones      TaskZones      `yaml:"zones" json:"zones"`
	DueDate    TaskDueDate    `yaml:"due_date" json:"due_date"`
	Recurrence TaskRecurrence `yaml:"recurrence" json:"recurrence"`
	Processing TaskProcessing `yaml:"processing" json:"processing"`
}

type TaskPriorities struct {
	Levels              []string           `yaml:"levels" json:"levels"`
	LootBonusByPriority map[string]float64 `yaml:"loot_bonus_by_priority" json:"loot_bonus_by_priority"`
}

type TaskZones struct {
	Allowed     []string `yaml:"allowed" json:"allowed"`
	DefaultZone string   `yaml:"default_zone" json:"default_zone"`
}

type TaskDueDate struct {
	GraceHours int `yaml:"grace_hours" json:"grace_hours"`
}

type TaskRecurrence struct {
	Supported                   []string `yaml:"supported" json:"supported"`
	DefaultOnCompleteReschedule bool     `yaml:"default_on_complete_reschedule" json:"default_on_complete_reschedule"`
}

type TaskProcessing struct {
	WorkedTodayMarksProgress           bool `yaml:"worked_today_marks_progress" json:"worked_today_marks_progress"`
	CompletionRequiresAssignedVillager bool `yaml:"completion_requires_assigned_villager" json:"completion_requires_assigned_villager"`
}

type Modifiers struct {
	GlobalRules GlobalModifierRules `yaml:"global_rules" json:"global_rules"`
	Types       []ModifierType      `yaml:"types" json:"types"`
}

type GlobalModifierRules struct {
	MaxModifiersPerTask    int      `yaml:"max_modifiers_per_task" json:"max_modifiers_per_task"`
	AllowDuplicateTypes    bool     `yaml:"allow_duplicate_types" json:"allow_duplicate_types"`
	DuplicateTypeAllowlist []string `yaml:"duplicate_type_allowlist" json:"duplicate_type_allowlist"`
}

type ModifierType struct {
	ID         string                 `yaml:"id" json:"id"`
	Label      string                 `yaml:"label" json:"label"`
	Category   string                 `yaml:"category" json:"category"`
	StackRules ModifierStackRules     `yaml:"stack_rules" json:"stack_rules"`
	Charges    ModifierCharges        `yaml:"charges" json:"charges"`
	Effects    map[string]interface{} `yaml:"effects" json:"effects"`
}

type ModifierStackRules struct {
	AttachTo      []string `yaml:"attach_to" json:"attach_to"`
	UniquePerTask bool     `yaml:"unique_per_task" json:"unique_per_task"`
	UniqueGlobal  bool     `yaml:"unique_global" json:"unique_global"`
}

type ModifierCharges struct {
	Mode          string   `yaml:"mode" json:"mode"`
	MaxCharges    int      `yaml:"max_charges" json:"max_charges"`
	ConsumeOn     []string `yaml:"consume_on" json:"consume_on"`
	SpentBehavior string   `yaml:"spent_behavior" json:"spent_behavior"`
}

type Resources struct {
	Nodes []ResourceNode `yaml:"nodes" json:"nodes"`
}

type ResourceNode struct {
	ID      string          `yaml:"id" json:"id"`
	Label   string          `yaml:"label" json:"label"`
	Charges ResourceCharges `yaml:"charges" json:"charges"`
	Gather  ResourceGather  `yaml:"gather" json:"gather"`
}

type ResourceCharges struct {
	Min int `yaml:"min" json:"min"`
	Max int `yaml:"max" json:"max"`
}

type ResourceGather struct {
	BaseTimeS             int                 `yaml:"base_time_s" json:"base_time_s"`
	TimeMultiplierByLevel map[int]float64     `yaml:"time_multiplier_by_level" json:"time_multiplier_by_level"`
	Produces              ResourceProduces    `yaml:"produces" json:"produces"`
	LootOnCycle           ResourceLootOnCycle `yaml:"loot_on_cycle" json:"loot_on_cycle"`
}

type ResourceProduces struct {
	ID     string `yaml:"id" json:"id"`
	Type   string `yaml:"type" json:"type"`
	Amount int    `yaml:"amount" json:"amount"`
}

type ResourceLootOnCycle struct {
	RNGPool []RNGPoolEntry `yaml:"rng_pool" json:"rng_pool"`
}

type RNGPoolEntry struct {
	ID     string `yaml:"id,omitempty" json:"id,omitempty"`
	Type   string `yaml:"type" json:"type"`
	Amount int    `yaml:"amount,omitempty" json:"amount,omitempty"`
	Weight int    `yaml:"weight" json:"weight"`
}

type Food struct {
	Items []FoodItem `yaml:"items" json:"items"`
}

type FoodItem struct {
	ID             string                 `yaml:"id" json:"id"`
	Label          string                 `yaml:"label" json:"label"`
	StaminaRestore int                    `yaml:"stamina_restore" json:"stamina_restore"`
	Effects        map[string]interface{} `yaml:"effects" json:"effects"`
}

type Loot struct {
	Types map[string]LootType `yaml:"types" json:"types"`
}

type LootType struct {
	Label     string `yaml:"label" json:"label"`
	Stackable bool   `yaml:"stackable" json:"stackable"`
}

type TaskCompletionDrops struct {
	Base       RNGPool                               `yaml:"base" json:"base"`
	ByModifier map[string]TaskCompletionModifierDrop `yaml:"by_modifier" json:"by_modifier"`
}

type RNGPool struct {
	RNGPool []RNGPoolEntry `yaml:"rng_pool" json:"rng_pool"`
}

type TaskCompletionModifierDrop struct {
	AddPool []RNGPoolEntry `yaml:"add_pool" json:"add_pool"`
}

type Decks struct {
	Economy DeckEconomy `yaml:"economy" json:"economy"`
	List    []Deck      `yaml:"list" json:"list"`
}

type DeckEconomy struct {
	BaseCostCurrency              string  `yaml:"base_cost_currency" json:"base_cost_currency"`
	ZombieCostMultiplierPerZombie float64 `yaml:"zombie_cost_multiplier_per_zombie" json:"zombie_cost_multiplier_per_zombie"`
	OverrunCostMultiplierPerLevel float64 `yaml:"overrun_cost_multiplier_per_level" json:"overrun_cost_multiplier_per_level"`
}

type Deck struct {
	ID              string                 `yaml:"id" json:"id"`
	Label           string                 `yaml:"label" json:"label"`
	Type            string                 `yaml:"type" json:"type"`
	Status          string                 `yaml:"status" json:"status"`
	BaseCost        int                    `yaml:"base_cost" json:"base_cost"`
	FreeOpens       int                    `yaml:"free_opens" json:"free_opens"`
	Description     string                 `yaml:"description" json:"description"`
	UnlockCondition map[string]interface{} `yaml:"unlock_condition" json:"unlock_condition"`
	Draws           DeckDraws              `yaml:"draws" json:"draws"`
}

type DeckDraws struct {
	Count   int            `yaml:"count" json:"count"`
	RNGPool []DeckRNGEntry `yaml:"rng_pool" json:"rng_pool"`
}

type DeckRNGEntry struct {
	CardType   string `yaml:"card_type" json:"card_type"`
	VillagerID string `yaml:"villager_id,omitempty" json:"villager_id,omitempty"`
	ModifierID string `yaml:"modifier_id,omitempty" json:"modifier_id,omitempty"`
	LootID     string `yaml:"loot_id,omitempty" json:"loot_id,omitempty"`
	ResourceID string `yaml:"resource_id,omitempty" json:"resource_id,omitempty"`
	FoodID     string `yaml:"food_id,omitempty" json:"food_id,omitempty"`
	Amount     int    `yaml:"amount,omitempty" json:"amount,omitempty"`
	Weight     int    `yaml:"weight" json:"weight"`
}

type Zombies struct {
	Types []ZombieType `yaml:"types" json:"types"`
}

type ZombieType struct {
	ID        string          `yaml:"id" json:"id"`
	Label     string          `yaml:"label" json:"label"`
	Behaviors ZombieBehaviors `yaml:"behaviors" json:"behaviors"`
	Cleanup   ZombieCleanup   `yaml:"cleanup" json:"cleanup"`
}

type ZombieBehaviors struct {
	DeckCostMultiplier float64       `yaml:"deck_cost_multiplier" json:"deck_cost_multiplier"`
	FatigueOnTick      FatigueOnTick `yaml:"fatigue_on_tick" json:"fatigue_on_tick"`
}

type FatigueOnTick struct {
	Enabled          bool `yaml:"enabled" json:"enabled"`
	StaminaReduction int  `yaml:"stamina_reduction" json:"stamina_reduction"`
}

type ZombieCleanup struct {
	StaminaCost   int     `yaml:"stamina_cost" json:"stamina_cost"`
	RewardOnClear RNGPool `yaml:"reward_on_clear" json:"reward_on_clear"`
}

type Salvage struct {
	Enabled             bool               `yaml:"enabled" json:"enabled"`
	SpentModifierToLoot map[string]RNGPool `yaml:"spent_modifier_to_loot" json:"spent_modifier_to_loot"`
}

type Rules struct {
	Stacking   StackingRules   `yaml:"stacking" json:"stacking"`
	Uniqueness UniquenessRules `yaml:"uniqueness" json:"uniqueness"`
}

type StackingRules struct {
	AllowedPairs [][]string `yaml:"allowed_pairs" json:"allowed_pairs"`
	Disallowed   [][]string `yaml:"disallowed" json:"disallowed"`
}

type UniquenessRules struct {
	GlobalUniqueModifiers []string `yaml:"global_unique_modifiers" json:"global_unique_modifiers"`
}

type UIHints struct {
	Highlights UIHighlights `yaml:"highlights" json:"highlights"`
	Board      UIBoard      `yaml:"board" json:"board"`
}

type UIHighlights struct {
	NextActionGlow  bool `yaml:"next_action_glow" json:"next_action_glow"`
	LegalStackGreen bool `yaml:"legal_stack_green" json:"legal_stack_green"`
	IllegalStackRed bool `yaml:"illegal_stack_red" json:"illegal_stack_red"`
}

type UIBoard struct {
	DefaultSpawnLayout DefaultSpawnLayout `yaml:"default_spawn_layout" json:"default_spawn_layout"`
}

type DefaultSpawnLayout struct {
	Villagers UILayoutVillagers `yaml:"villagers" json:"villagers"`
	Tasks     UILayoutTasks     `yaml:"tasks" json:"tasks"`
	Zombies   UILayoutZombies   `yaml:"zombies" json:"zombies"`
}

type UILayoutVillagers struct {
	StartX int `yaml:"start_x" json:"start_x"`
	StartY int `yaml:"start_y" json:"start_y"`
	DX     int `yaml:"dx" json:"dx"`
}

type UILayoutTasks struct {
	StartX   int `yaml:"start_x" json:"start_x"`
	StartY   int `yaml:"start_y" json:"start_y"`
	GridCols int `yaml:"grid_cols" json:"grid_cols"`
	DX       int `yaml:"dx" json:"dx"`
	DY       int `yaml:"dy" json:"dy"`
}

type UILayoutZombies struct {
	StartX int `yaml:"start_x" json:"start_x"`
	StartY int `yaml:"start_y" json:"start_y"`
	DX     int `yaml:"dx" json:"dx"`
}

type BoardUIConfig struct {
	GridSize     int `yaml:"grid_size" json:"grid_size"`
	CardWidth    int `yaml:"card_width" json:"card_width"`
	CardHeight   int `yaml:"card_height" json:"card_height"`
	StackOffsetY int `yaml:"stack_offset_y" json:"stack_offset_y"`
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

func (c *Config) ApplyDefaults() {
	c.UI.Board.ApplyDefaults()
}

func Load(path string) (*Config, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var r Config
	if err := yaml.Unmarshal(b, &r); err != nil {
		return nil, err
	}
	r.ApplyDefaults()
	return &r, nil
}

package player

const (
	LootCoin           = "coin"
	LootPaper          = "paper"
	LootInk            = "ink"
	LootGear           = "gear"
	LootParts          = "parts"
	LootBlueprintShard = "blueprint_shard"
)

const (
	FeatureTaskDueDate    = "task.due_date"
	FeatureTaskNextAction = "task.next_action"
	FeatureTaskRecurrence = "task.recurrence"
)

const (
	CostSpawnTaskToBoardCoin = 3
	CostUnlockDueDateCoin    = 2
	CostUnlockNextActionCoin = 2
	CostUnlockRecurrenceCoin = 3
)

type UserState struct {
	Loot            map[string]int  `json:"loot"`
	Unlocks         map[string]bool `json:"unlocks"`
	VillagerStamina map[string]int  `json:"villagerStamina,omitempty"`
}

type fileState struct {
	Users map[string]UserState `json:"users"`
}

type StateResponse struct {
	Loot            map[string]int  `json:"loot"`
	Unlocks         map[string]bool `json:"unlocks"`
	VillagerStamina map[string]int  `json:"villagerStamina,omitempty"`
	Costs           CostResponse    `json:"costs"`
}

type CostResponse struct {
	SpawnTaskToBoardCoin int            `json:"spawnTaskToBoardCoin"`
	Unlocks              map[string]int `json:"unlocks"`
}

func defaultUserState() UserState {
	return UserState{
		Loot: map[string]int{
			LootCoin:           0,
			LootPaper:          0,
			LootInk:            0,
			LootGear:           0,
			LootParts:          0,
			LootBlueprintShard: 0,
		},
		Unlocks: map[string]bool{
			FeatureTaskDueDate:    false,
			FeatureTaskNextAction: false,
			FeatureTaskRecurrence: false,
		},
		VillagerStamina: map[string]int{},
	}
}

func normalizeUserState(s UserState) UserState {
	out := defaultUserState()
	for k, v := range s.Loot {
		out.Loot[k] = v
	}
	for k, v := range s.Unlocks {
		out.Unlocks[k] = v
	}
	for k, v := range s.VillagerStamina {
		out.VillagerStamina[k] = v
	}
	return out
}

func defaultCosts() CostResponse {
	return CostResponse{
		SpawnTaskToBoardCoin: CostSpawnTaskToBoardCoin,
		Unlocks: map[string]int{
			FeatureTaskDueDate:    CostUnlockDueDateCoin,
			FeatureTaskNextAction: CostUnlockNextActionCoin,
			FeatureTaskRecurrence: CostUnlockRecurrenceCoin,
		},
	}
}

package player

import "time"

const (
	LootCoin           = "coin"
	LootPaper          = "paper"
	LootInk            = "ink"
	LootGear           = "gear"
	LootParts          = "parts"
	LootBlueprintShard = "blueprint_shard"
)

const (
	MetricZombiesSeen    = "zombies_seen"
	MetricOverrunLevel   = "overrun_level"
	MetricTasksCompleted = "tasks_completed"
	MetricZombiesCleared = "zombies_cleared"
)

const (
	PerkStaminaPlus1 = "perk_stamina_plus_1"
	PerkZombieSlayer = "perk_zombie_slayer"
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
	Loot            map[string]int              `json:"loot"`
	Unlocks         map[string]bool             `json:"unlocks"`
	VillagerStamina map[string]int              `json:"villagerStamina,omitempty"`
	Villagers       map[string]VillagerProgress `json:"villagers,omitempty"`
	Metrics         map[string]int              `json:"metrics,omitempty"`
	DeckOpens       map[string]int              `json:"deckOpens,omitempty"`
	Profile         PlayerProfile               `json:"profile"`
}

type fileState struct {
	Users map[string]UserState `json:"users"`
}

type VillagerProgress struct {
	XP    int      `json:"xp"`
	Level int      `json:"level"`
	Perks []string `json:"perks,omitempty"`
}

type TeamMember struct {
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	Status    string    `json:"status"`
	InvitedAt time.Time `json:"invitedAt,omitempty"`
}

type TeamProfile struct {
	ID      string       `json:"id"`
	Name    string       `json:"name"`
	Avatar  string       `json:"avatar,omitempty"`
	Members []TeamMember `json:"members,omitempty"`
}

type PlayerProfile struct {
	DisplayName           string      `json:"displayName,omitempty"`
	Avatar                string      `json:"avatar,omitempty"`
	OnboardingCompleted   bool        `json:"onboardingCompleted"`
	OnboardingCompletedAt time.Time   `json:"onboardingCompletedAt,omitempty"`
	Team                  TeamProfile `json:"team"`
}

type StateResponse struct {
	Loot            map[string]int              `json:"loot"`
	Unlocks         map[string]bool             `json:"unlocks"`
	VillagerStamina map[string]int              `json:"villagerStamina,omitempty"`
	Villagers       map[string]VillagerProgress `json:"villagers,omitempty"`
	Metrics         map[string]int              `json:"metrics,omitempty"`
	DeckOpens       map[string]int              `json:"deckOpens,omitempty"`
	Profile         PlayerProfile               `json:"profile"`
	Costs           CostResponse                `json:"costs"`
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
		Villagers:       map[string]VillagerProgress{},
		Metrics: map[string]int{
			MetricZombiesSeen:    0,
			MetricOverrunLevel:   0,
			MetricTasksCompleted: 0,
			MetricZombiesCleared: 0,
		},
		DeckOpens: map[string]int{},
		Profile: PlayerProfile{
			OnboardingCompleted: false,
			Team: TeamProfile{
				ID:      "",
				Name:    "My Team",
				Members: []TeamMember{},
			},
		},
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
	for k, v := range s.Villagers {
		if v.Level <= 0 {
			v.Level = 1
		}
		out.Villagers[k] = VillagerProgress{
			XP:    v.XP,
			Level: v.Level,
			Perks: append([]string{}, v.Perks...),
		}
	}
	for k, v := range s.Metrics {
		out.Metrics[k] = v
	}
	for k, v := range s.DeckOpens {
		out.DeckOpens[k] = v
	}
	out.Profile = normalizeProfile(s.Profile, "default")
	return out
}

func normalizeProfile(in PlayerProfile, userID string) PlayerProfile {
	out := in
	if out.Team.ID == "" || out.Team.ID == "team_default" {
		if userID == "" {
			userID = "default"
		}
		out.Team.ID = "team_" + userID
	}
	if out.Team.Name == "" {
		out.Team.Name = "My Team"
	}
	if out.Team.Members == nil {
		out.Team.Members = []TeamMember{}
	}
	members := make([]TeamMember, 0, len(out.Team.Members))
	for _, m := range out.Team.Members {
		if m.Email == "" {
			continue
		}
		if m.Role == "" {
			m.Role = "member"
		}
		if m.Status == "" {
			m.Status = "invited"
		}
		members = append(members, m)
	}
	out.Team.Members = members
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

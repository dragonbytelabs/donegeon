package quest

import "time"

// SeedQuests returns the initial quests for Day 1-7
func SeedQuests() []Quest {
	return []Quest{
		// Day 1 - Awakening (Story Quest)
		{
			ID:          "W01_Awakening",
			Title:       "Awakening",
			Description: "Create your first task and begin your journey",
			Type:        TypeStory,
			Scope:       ScopeDay,
			Season:      SeasonSpring,
			Difficulty:  "intro",
			Week:        1,
			Day:         1,
			Status:      StatusActive,
			Objectives: []Objective{
				{
					Op:         OpCreateTask,
					Count:      1,
					TimeWindow: TimeToday,
				},
			},
			Rewards: []Reward{
				{
					Kind:     RewardCurrency,
					Currency: "coin",
					Amount:   50,
				},
				{
					Kind:      RewardCard,
					CardType:  CardVillager,
					CardCount: 1,
				},
			},
			Unlocks: []Unlock{
				{
					Kind: "deck",
					ID:   "deck_first_day",
				},
			},
		},

		// Day 2 - Time Has Weight
		{
			ID:          "W01_TimeHasWeight",
			Title:       "Time Has Weight",
			Description: "Complete your first task and feel the momentum",
			Type:        TypeStory,
			Scope:       ScopeDay,
			Season:      SeasonSpring,
			Difficulty:  "intro",
			Week:        1,
			Day:         2,
			Status:      StatusLocked,
			Objectives: []Objective{
				{
					Op:         OpCompleteTask,
					Count:      1,
					TimeWindow: TimeToday,
				},
			},
			Rewards: []Reward{
				{
					Kind:     RewardCurrency,
					Currency: "coin",
					Amount:   25,
				},
			},
		},

		// Day 3 - Work Requires Workers
		{
			ID:          "W01_WorkRequiresWorkers",
			Title:       "Work Requires Workers",
			Description: "Assign a villager to help with your tasks",
			Type:        TypeStory,
			Scope:       ScopeDay,
			Season:      SeasonSpring,
			Difficulty:  "intro",
			Week:        1,
			Day:         3,
			Status:      StatusLocked,
			Objectives: []Objective{
				{
					Op:         OpAssignVillager,
					Count:      1,
					TimeWindow: TimeToday,
				},
			},
			Rewards: []Reward{
				{
					Kind:      RewardCard,
					CardType:  CardVillager,
					CardCount: 1,
				},
				{
					Kind:     RewardCurrency,
					Currency: "coin",
					Amount:   30,
				},
			},
		},

		// Day 7 - Boss: The Backlog
		{
			ID:          "B01_BacklogSeed",
			Title:       "Boss: The Backlog Seed",
			Description: "Complete 3 tasks this week to prove your resolve",
			Type:        TypeBoss,
			Scope:       ScopeWeek,
			Season:      SeasonSpring,
			Difficulty:  "easy",
			Week:        1,
			Day:         7,
			Status:      StatusLocked,
			Objectives: []Objective{
				{
					Op:         OpCompleteTask,
					Count:      3,
					TimeWindow: TimeThisWeek,
				},
			},
			Rewards: []Reward{
				{
					Kind:     RewardCurrency,
					Currency: "coin",
					Amount:   150,
				},
				{
					Kind:      RewardCard,
					CardType:  CardRecurring,
					CardCount: 1,
				},
			},
		},

		// Daily Quests - Pool
		{
			ID:          "DQ_CompleteAny",
			Title:       "Daily Momentum",
			Description: "Complete any task today",
			Type:        TypeDaily,
			Scope:       ScopeDay,
			Difficulty:  "easy",
			Status:      StatusLocked,
			Objectives: []Objective{
				{
					Op:         OpCompleteTask,
					Count:      1,
					TimeWindow: TimeToday,
				},
			},
			Rewards: []Reward{
				{
					Kind:     RewardCurrency,
					Currency: "coin",
					Amount:   10,
				},
				{
					Kind: RewardXP,
					XP:   5,
				},
			},
		},

		{
			ID:          "DQ_CreateTask",
			Title:       "Capture a Task",
			Description: "Create a new task today",
			Type:        TypeDaily,
			Scope:       ScopeDay,
			Difficulty:  "easy",
			Status:      StatusLocked,
			Objectives: []Objective{
				{
					Op:         OpCreateTask,
					Count:      1,
					TimeWindow: TimeToday,
				},
			},
			Rewards: []Reward{
				{
					Kind:     RewardCurrency,
					Currency: "coin",
					Amount:   5,
				},
			},
		},

		{
			ID:          "DQ_ProcessTwo",
			Title:       "Double Down",
			Description: "Complete 2 tasks today",
			Type:        TypeDaily,
			Scope:       ScopeDay,
			Difficulty:  "medium",
			Status:      StatusLocked,
			Objectives: []Objective{
				{
					Op:         OpCompleteTask,
					Count:      2,
					TimeWindow: TimeToday,
				},
			},
			Rewards: []Reward{
				{
					Kind:     RewardCurrency,
					Currency: "coin",
					Amount:   20,
				},
				{
					Kind: RewardXP,
					XP:   10,
				},
			},
		},
	}
}

// ActivateDay1Quest manually activates the first quest
func ActivateDay1Quest(q *Quest) {
	if q.ID == "W01_Awakening" {
		q.Status = StatusActive
		now := time.Now()
		q.ActivatedAt = &now
	}
}

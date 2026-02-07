package board

import (
	"testing"
	"time"

	"donegeon/internal/config"
	"donegeon/internal/model"
	"donegeon/internal/player"
	"donegeon/internal/task"
)

func TestCommand_WorldEndDay_SpawnsOverdueZombiesAndResetsState(t *testing.T) {
	taskRepo := task.NewMemoryRepo()
	playerRepo, err := player.NewFileRepo(t.TempDir())
	if err != nil {
		t.Fatalf("new player repo: %v", err)
	}
	playerRepo = playerRepo.ForUser("u-phase4")

	cfg := testBoardConfig()
	cfg.World = config.WorldConfig{
		DayTick: config.DayTick{
			MaxZombiesSpawnPerDay: 3,
			StaminaReset: config.StaminaReset{
				Enabled: true,
				Mode:    "full",
			},
			OverdueRules: config.OverdueRules{
				ZombieSpawn: config.ZombieSpawn{
					Enabled:        true,
					PerOverdueTask: 2,
					CapPerDay:      3,
				},
			},
			RecurrenceRules: config.RecurrenceRules{
				SpawnIfDue: true,
			},
		},
	}
	cfg.Tasks.DueDate.GraceHours = 0
	cfg.Villagers.Defaults.BaseMaxStamina = 6
	cfg.Zombies.Types = []config.ZombieType{
		{
			ID: "default_zombie",
		},
	}
	cfg.UIHints.Board.DefaultSpawnLayout.Zombies = config.UILayoutZombies{
		StartX: 900,
		StartY: 160,
		DX:     80,
	}

	h := NewHandler(NewMemoryRepo(), taskRepo, cfg)
	state := model.NewBoardState()

	villager := state.CreateCard("villager.basic", map[string]any{"name": "Pip"})
	villagerStack := state.CreateStack(model.Point{X: 220, Y: 210}, []model.CardID{villager.ID})
	if ok, remaining, _, err := playerRepo.SpendVillagerStamina(string(villagerStack.ID), 3, 6); err != nil || !ok || remaining != 3 {
		t.Fatalf("seed villager stamina: ok=%v remaining=%d err=%v", ok, remaining, err)
	}

	inbox := "inbox"
	yesterday := time.Now().AddDate(0, 0, -1).Format(ymdLayout)
	today := time.Now().Format(ymdLayout)

	overdueTask, err := taskRepo.Create(model.Task{
		Title:   "Overdue",
		Project: &inbox,
		DueDate: &yesterday,
	})
	if err != nil {
		t.Fatalf("create overdue task: %v", err)
	}
	recurringTask, err := taskRepo.Create(model.Task{
		Title:   "Recurring",
		Project: &inbox,
		DueDate: &today,
		Done:    true,
		Recurrence: &model.Recurrence{
			Type:     "weekly",
			Interval: 1,
		},
	})
	if err != nil {
		t.Fatalf("create recurring task: %v", err)
	}
	workedTask, err := taskRepo.Create(model.Task{
		Title:       "Worked",
		Project:     &inbox,
		WorkedToday: true,
	})
	if err != nil {
		t.Fatalf("create worked task: %v", err)
	}

	if _, err := h.executeCommand(state, taskRepo, playerRepo, "world.end_day", map[string]any{}); err != nil {
		t.Fatalf("world.end_day: %v", err)
	}

	if got := countZombieStacks(state); got != 2 {
		t.Fatalf("expected 2 spawned zombies, got %d", got)
	}

	updatedRecurring, err := taskRepo.Get(recurringTask.ID)
	if err != nil {
		t.Fatalf("get recurring task: %v", err)
	}
	if updatedRecurring.Done {
		t.Fatalf("expected recurring task to be reopened after day tick")
	}
	if updatedRecurring.DueDate == nil || *updatedRecurring.DueDate <= today {
		t.Fatalf("expected recurring task due date to move forward, got %v", updatedRecurring.DueDate)
	}

	updatedWorked, err := taskRepo.Get(workedTask.ID)
	if err != nil {
		t.Fatalf("get worked task: %v", err)
	}
	if updatedWorked.WorkedToday {
		t.Fatalf("expected workedToday to be cleared by day tick")
	}

	updatedOverdue, err := taskRepo.Get(overdueTask.ID)
	if err != nil {
		t.Fatalf("get overdue task: %v", err)
	}
	if updatedOverdue.Done {
		t.Fatalf("expected overdue task to stay pending")
	}

	stamina := playerRepo.GetState().VillagerStamina[string(villagerStack.ID)]
	if stamina != 6 {
		t.Fatalf("expected villager stamina reset to 6, got %d", stamina)
	}
}

func TestCommand_ZombieClear_RemovesZombieAndGrantsReward(t *testing.T) {
	playerRepo, err := player.NewFileRepo(t.TempDir())
	if err != nil {
		t.Fatalf("new player repo: %v", err)
	}
	playerRepo = playerRepo.ForUser("u-phase4")

	cfg := testBoardConfig()
	cfg.Villagers.Defaults.BaseMaxStamina = 6
	cfg.Villagers.Actions.ClearZombie = config.ClearZombieAction{
		StaminaCost:       2,
		MinCostAfterPerks: 1,
	}
	cfg.Zombies.Types = []config.ZombieType{
		{
			ID: "default_zombie",
			Cleanup: config.ZombieCleanup{
				StaminaCost: 2,
				RewardOnClear: config.RNGPool{
					RNGPool: []config.RNGPoolEntry{
						{Type: "loot", ID: player.LootCoin, Amount: 2, Weight: 10},
						{Type: "none", Weight: 2},
					},
				},
			},
		},
	}

	h := NewHandler(NewMemoryRepo(), task.NewMemoryRepo(), cfg)
	state := model.NewBoardState()

	villager := state.CreateCard("villager.basic", map[string]any{"name": "Pip"})
	villagerStack := state.CreateStack(model.Point{X: 280, Y: 220}, []model.CardID{villager.ID})
	zombie := state.CreateCard("zombie.default_zombie", map[string]any{"reason": "overdue_task"})
	zombieStack := state.CreateStack(model.Point{X: 500, Y: 260}, []model.CardID{zombie.ID})

	if _, err := h.executeCommand(state, nil, playerRepo, "zombie.clear", map[string]any{
		"zombieStackId":   string(zombieStack.ID),
		"villagerStackId": string(villagerStack.ID),
		"targetStackId":   string(zombieStack.ID),
	}); err != nil {
		t.Fatalf("zombie.clear: %v", err)
	}

	if state.GetStack(zombieStack.ID) != nil {
		t.Fatalf("expected zombie stack to be removed after clear")
	}

	updatedVillagerStack := state.GetStack(villagerStack.ID)
	if updatedVillagerStack == nil {
		t.Fatalf("expected villager stack to remain after zombie clear")
	}
	if updatedVillagerStack.Pos != zombieStack.Pos {
		t.Fatalf("expected villager stack to move to zombie position, got %+v want %+v", updatedVillagerStack.Pos, zombieStack.Pos)
	}

	wallet := playerRepo.GetState().Loot
	if got := wallet[player.LootCoin]; got != 2 {
		t.Fatalf("expected zombie clear reward coin=2, got %d", got)
	}
	stamina := playerRepo.GetState().VillagerStamina[string(villagerStack.ID)]
	if stamina != 4 {
		t.Fatalf("expected villager stamina 4 after clear, got %d", stamina)
	}
}

func TestCommand_WorldEndDay_ZombieSpawnChanceZeroSkipsSpawn(t *testing.T) {
	taskRepo := task.NewMemoryRepo()
	playerRepo, err := player.NewFileRepo(t.TempDir())
	if err != nil {
		t.Fatalf("new player repo: %v", err)
	}
	playerRepo = playerRepo.ForUser("u-phase4-chance")

	cfg := testBoardConfig()
	zeroChance := 0.0
	cfg.World.DayTick.OverdueRules.ZombieSpawn = config.ZombieSpawn{
		Enabled:        true,
		PerOverdueTask: 1,
		CapPerDay:      5,
		SpawnChance:    &zeroChance,
	}
	cfg.Zombies.Types = []config.ZombieType{{ID: "default_zombie"}}
	cfg.Tasks.DueDate.GraceHours = 0

	inbox := "inbox"
	yesterday := time.Now().AddDate(0, 0, -1).Format(ymdLayout)
	if _, err := taskRepo.Create(model.Task{
		Title:   "Overdue no spawn",
		Project: &inbox,
		DueDate: &yesterday,
	}); err != nil {
		t.Fatalf("create task: %v", err)
	}

	h := NewHandler(NewMemoryRepo(), taskRepo, cfg)
	state := model.NewBoardState()

	if _, err := h.executeCommand(state, taskRepo, playerRepo, "world.end_day", map[string]any{}); err != nil {
		t.Fatalf("world.end_day: %v", err)
	}
	if got := countZombieStacks(state); got != 0 {
		t.Fatalf("expected 0 zombies with spawn chance 0, got %d", got)
	}
}

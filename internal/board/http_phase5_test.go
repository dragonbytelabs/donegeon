package board

import (
	"strings"
	"testing"

	"donegeon/internal/config"
	"donegeon/internal/model"
	"donegeon/internal/player"
	"donegeon/internal/task"
)

func TestCommand_TaskCompleteStack_AwardsVillagerProgression(t *testing.T) {
	taskRepo := task.NewMemoryRepo()
	playerRepo, err := player.NewFileRepo(t.TempDir())
	if err != nil {
		t.Fatalf("new player repo: %v", err)
	}
	playerRepo = playerRepo.ForUser("u-phase5")

	cfg := testBoardConfig()
	cfg.Tasks.Processing.CompletionRequiresAssignedVillager = true
	cfg.Villagers.Defaults.MaxLevel = 10
	cfg.Villagers.Leveling.Thresholds = map[int]int{
		1: 0,
		2: 5,
	}
	cfg.Villagers.Leveling.ChoicesPerLevel = 1
	cfg.Villagers.Leveling.PerkPool = []config.Perk{
		{ID: player.PerkStaminaPlus1, Apply: map[string]any{"max_stamina_add": 1}},
	}
	cfg.Villagers.Leveling.XPSources.CompleteTask.BaseXP = 5

	h := NewHandler(NewMemoryRepo(), taskRepo, cfg)
	state := model.NewBoardState()

	inbox := "inbox"
	taskRow, err := taskRepo.Create(model.Task{
		Title:   "Phase5 Task",
		Project: &inbox,
	})
	if err != nil {
		t.Fatalf("create task: %v", err)
	}
	if err := taskRepo.SetLive(taskRow.ID, true); err != nil {
		t.Fatalf("set live: %v", err)
	}

	villagerID := "villager_progress_1"
	villager := state.CreateCard("villager.basic", map[string]any{"name": "Pip"})
	taskCard := state.CreateCard("task.instance", map[string]any{
		"taskId":             string(taskRow.ID),
		"assignedVillagerId": villagerID,
	})
	stack := state.CreateStack(model.Point{X: 300, Y: 300}, []model.CardID{villager.ID, taskCard.ID})

	if _, err := h.executeCommand(state, taskRepo, playerRepo, "task.complete_stack", map[string]any{
		"stackId": string(stack.ID),
	}); err != nil {
		t.Fatalf("task.complete_stack: %v", err)
	}

	progress := playerRepo.GetVillagerProgress(villagerID)
	if progress.XP != 5 {
		t.Fatalf("expected villager XP=5, got %d", progress.XP)
	}
	if progress.Level != 2 {
		t.Fatalf("expected villager Level=2, got %d", progress.Level)
	}
	if len(progress.Perks) != 1 || progress.Perks[0] != player.PerkStaminaPlus1 {
		t.Fatalf("expected perk %q awarded, got %+v", player.PerkStaminaPlus1, progress.Perks)
	}
	if got := playerRepo.GetMetric(player.MetricTasksCompleted); got != 1 {
		t.Fatalf("expected tasks_completed metric 1, got %d", got)
	}
}

func TestCommand_DeckOpen_EnforcesUnlocksAndEconomyCosts(t *testing.T) {
	taskRepo := task.NewMemoryRepo()
	playerRepo, err := player.NewFileRepo(t.TempDir())
	if err != nil {
		t.Fatalf("new player repo: %v", err)
	}
	playerRepo = playerRepo.ForUser("u-phase5")
	if _, err := playerRepo.AddLoot(player.LootCoin, 100); err != nil {
		t.Fatalf("seed coin: %v", err)
	}

	cfg := testBoardConfig()
	cfg.Decks.Economy.ZombieCostMultiplierPerZombie = 0.10
	cfg.Decks.Economy.OverrunCostMultiplierPerLevel = 0.10
	cfg.Decks.List = []config.Deck{
		{
			ID:        "deck.organization",
			Status:    "locked",
			BaseCost:  10,
			FreeOpens: 0,
			UnlockCondition: map[string]any{
				"type":  "processed_tasks_gte",
				"value": 2,
			},
			Draws: config.DeckDraws{
				Count: 1,
				RNGPool: []config.DeckRNGEntry{
					{CardType: "blank", Weight: 1},
				},
			},
		},
	}

	h := NewHandler(NewMemoryRepo(), taskRepo, cfg)
	state := model.NewBoardState()

	inbox := "inbox"
	taskRow, err := taskRepo.Create(model.Task{Title: "Work", Project: &inbox})
	if err != nil {
		t.Fatalf("create task: %v", err)
	}
	delta := 1
	if _, err := taskRepo.Update(taskRow.ID, task.Patch{ProcessedCountDelta: &delta}); err != nil {
		t.Fatalf("seed processed count: %v", err)
	}

	deckCard := state.CreateCard("deck.organization", nil)
	deckStack := state.CreateStack(model.Point{X: 100, Y: 500}, []model.CardID{deckCard.ID})

	if _, err := h.executeCommand(state, nil, nil, "deck.spawn_pack", map[string]any{
		"deckStackId": string(deckStack.ID),
		"x":           float64(260),
		"y":           float64(260),
		"packDefId":   "deck.first_day_pack",
	}); err != nil {
		t.Fatalf("deck.spawn_pack: %v", err)
	}

	packStackID := findStackWithTopDef(state, "deck.first_day_pack")
	if packStackID == "" {
		t.Fatalf("expected deck pack stack")
	}

	_, err = h.executeCommand(state, taskRepo, playerRepo, "deck.open_pack", map[string]any{
		"packStackId": packStackID,
		"deckId":      "deck.organization",
		"radius":      float64(120),
		"seed":        float64(42),
	})
	if err == nil || !strings.Contains(err.Error(), "deck is locked") {
		t.Fatalf("expected locked deck error, got %v", err)
	}

	if _, err := taskRepo.Update(taskRow.ID, task.Patch{ProcessedCountDelta: &delta}); err != nil {
		t.Fatalf("bump processed count: %v", err)
	}
	if _, err := playerRepo.SetMetric(player.MetricOverrunLevel, 3); err != nil {
		t.Fatalf("set overrun metric: %v", err)
	}
	_ = state.CreateStack(model.Point{X: 1200, Y: 120}, []model.CardID{state.CreateCard("zombie.default_zombie", nil).ID})
	_ = state.CreateStack(model.Point{X: 1320, Y: 120}, []model.CardID{state.CreateCard("zombie.default_zombie", nil).ID})

	if _, err := h.executeCommand(state, taskRepo, playerRepo, "deck.open_pack", map[string]any{
		"packStackId": packStackID,
		"deckId":      "deck.organization",
		"radius":      float64(120),
		"seed":        float64(42),
	}); err != nil {
		t.Fatalf("deck.open_pack: %v", err)
	}

	// cost = ceil(10 * (1 + 2*0.1 + 3*0.1)) = 15
	if got := playerRepo.GetState().Loot[player.LootCoin]; got != 85 {
		t.Fatalf("expected coin after deck open to be 85, got %d", got)
	}
	if got := playerRepo.GetDeckOpenCount("deck.organization"); got != 1 {
		t.Fatalf("expected deck open count 1, got %d", got)
	}
}

func TestCommand_ZombieClear_AppliesPerkCostReduction(t *testing.T) {
	playerRepo, err := player.NewFileRepo(t.TempDir())
	if err != nil {
		t.Fatalf("new player repo: %v", err)
	}
	playerRepo = playerRepo.ForUser("u-phase5")

	cfg := testBoardConfig()
	cfg.Villagers.Defaults.BaseMaxStamina = 6
	cfg.Villagers.Leveling.Thresholds = map[int]int{1: 0, 2: 1}
	cfg.Villagers.Leveling.ChoicesPerLevel = 1
	cfg.Villagers.Leveling.PerkPool = []config.Perk{
		{
			ID: player.PerkZombieSlayer,
			Apply: map[string]any{
				"zombie_clear_stamina_cost_add": -1,
				"min_zombie_clear_cost":         1,
			},
		},
	}
	cfg.Villagers.Actions.ClearZombie = config.ClearZombieAction{
		StaminaCost:       2,
		MinCostAfterPerks: 1,
	}
	cfg.Zombies.Types = []config.ZombieType{
		{
			ID: "default_zombie",
			Cleanup: config.ZombieCleanup{
				StaminaCost: 2,
			},
		},
	}

	h := NewHandler(NewMemoryRepo(), task.NewMemoryRepo(), cfg)
	state := model.NewBoardState()

	villager := state.CreateCard("villager.basic", map[string]any{"name": "Pip"})
	villagerStack := state.CreateStack(model.Point{X: 300, Y: 300}, []model.CardID{villager.ID})
	villagerID := string(villagerStack.ID)
	if _, _, _, err := playerRepo.AddVillagerXP(
		villagerID,
		1,
		cfg.Villagers.Leveling.Thresholds,
		cfg.Villagers.Defaults.MaxLevel,
		[]string{player.PerkZombieSlayer},
		1,
	); err != nil {
		t.Fatalf("grant perk XP: %v", err)
	}

	zombie := state.CreateCard("zombie.default_zombie", nil)
	zombieStack := state.CreateStack(model.Point{X: 520, Y: 300}, []model.CardID{zombie.ID})

	if _, err := h.executeCommand(state, nil, playerRepo, "zombie.clear", map[string]any{
		"zombieStackId":   string(zombieStack.ID),
		"villagerStackId": villagerID,
		"targetStackId":   string(zombieStack.ID),
	}); err != nil {
		t.Fatalf("zombie.clear: %v", err)
	}

	stamina := playerRepo.GetState().VillagerStamina[villagerID]
	if stamina != 5 {
		t.Fatalf("expected reduced clear cost (remaining stamina 5), got %d", stamina)
	}
}

func TestCommand_ResourceGather_ConsumesChargeSpawnsProductsAndAwardsXP(t *testing.T) {
	playerRepo, err := player.NewFileRepo(t.TempDir())
	if err != nil {
		t.Fatalf("new player repo: %v", err)
	}
	playerRepo = playerRepo.ForUser("u-phase5-gather")

	cfg := testBoardConfig()
	cfg.Villagers.Defaults.BaseMaxStamina = 6
	cfg.Villagers.Actions.GatherStart = config.ActionCost{StaminaCost: 1}
	cfg.Villagers.Leveling.Thresholds = map[int]int{1: 0, 2: 2}
	cfg.Villagers.Leveling.XPSources.GatherResourceCycle.BaseXP = 2
	cfg.Resources.Nodes = []config.ResourceNode{
		{
			ID: "scrap_pile",
			Gather: config.ResourceGather{
				Produces: config.ResourceProduces{
					Type:   "loot",
					ID:     "parts",
					Amount: 1,
				},
				LootOnCycle: config.ResourceLootOnCycle{
					RNGPool: []config.RNGPoolEntry{
						{Type: "loot", ID: "gear", Amount: 1, Weight: 10},
					},
				},
			},
		},
	}

	h := NewHandler(NewMemoryRepo(), task.NewMemoryRepo(), cfg)
	state := model.NewBoardState()

	villager := state.CreateCard("villager.basic", map[string]any{"name": "Pip"})
	villagerStack := state.CreateStack(model.Point{X: 100, Y: 100}, []model.CardID{villager.ID})
	resource := state.CreateCard("resource.scrap_pile", map[string]any{"charges": 1})
	resourceStack := state.CreateStack(model.Point{X: 240, Y: 100}, []model.CardID{resource.ID})

	if _, err := h.executeCommand(state, nil, playerRepo, "resource.gather", map[string]any{
		"resourceStackId": string(resourceStack.ID),
		"villagerStackId": string(villagerStack.ID),
		"targetStackId":   string(resourceStack.ID),
	}); err != nil {
		t.Fatalf("resource.gather: %v", err)
	}

	if state.GetStack(resourceStack.ID) != nil {
		t.Fatalf("expected resource stack removed after last charge")
	}
	if got := playerRepo.GetState().VillagerStamina[string(villagerStack.ID)]; got != 5 {
		t.Fatalf("expected villager stamina 5 after gather, got %d", got)
	}
	if progress := playerRepo.GetVillagerProgress(string(villagerStack.ID)); progress.XP != 2 {
		t.Fatalf("expected villager XP 2 from gather, got %d", progress.XP)
	}

	partsFound := false
	gearFound := false
	for _, stack := range state.Stacks {
		card := state.GetCard(stack.Cards[len(stack.Cards)-1])
		if card == nil {
			continue
		}
		switch card.DefID {
		case "loot.parts":
			partsFound = true
		case "loot.gear":
			gearFound = true
		}
	}
	if !partsFound {
		t.Fatalf("expected gather to spawn loot.parts")
	}
	if !gearFound {
		t.Fatalf("expected gather bonus to spawn loot.gear")
	}
}

func TestCommand_FoodConsume_RestoresStaminaAndConsumesFood(t *testing.T) {
	playerRepo, err := player.NewFileRepo(t.TempDir())
	if err != nil {
		t.Fatalf("new player repo: %v", err)
	}
	playerRepo = playerRepo.ForUser("u-phase5-food")

	cfg := testBoardConfig()
	cfg.Villagers.Defaults.BaseMaxStamina = 6
	cfg.Villagers.Actions.EatFood = config.ActionCost{StaminaCost: 0}
	cfg.Food.Items = []config.FoodItem{
		{
			ID:             "berries",
			StaminaRestore: 2,
		},
	}

	h := NewHandler(NewMemoryRepo(), task.NewMemoryRepo(), cfg)
	state := model.NewBoardState()

	villager := state.CreateCard("villager.basic", map[string]any{"name": "Pip"})
	villagerStack := state.CreateStack(model.Point{X: 100, Y: 100}, []model.CardID{villager.ID})
	food := state.CreateCard("food.berries", map[string]any{"amount": 1})
	foodStack := state.CreateStack(model.Point{X: 240, Y: 100}, []model.CardID{food.ID})

	if ok, _, _, err := playerRepo.SpendVillagerStamina(string(villagerStack.ID), 3, 6); err != nil || !ok {
		t.Fatalf("seed stamina spend failed: ok=%v err=%v", ok, err)
	}

	if _, err := h.executeCommand(state, nil, playerRepo, "food.consume", map[string]any{
		"foodStackId":     string(foodStack.ID),
		"villagerStackId": string(villagerStack.ID),
		"targetStackId":   string(foodStack.ID),
	}); err != nil {
		t.Fatalf("food.consume: %v", err)
	}

	if got := playerRepo.GetState().VillagerStamina[string(villagerStack.ID)]; got != 5 {
		t.Fatalf("expected villager stamina restored to 5, got %d", got)
	}
	if state.GetStack(foodStack.ID) != nil {
		t.Fatalf("expected food stack removed after consume")
	}
}

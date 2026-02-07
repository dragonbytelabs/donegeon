package board

import (
	"testing"

	"donegeon/internal/config"
	"donegeon/internal/model"
	"donegeon/internal/player"
	"donegeon/internal/task"
)

func TestCommand_TaskSetTitlePromotesBlankCardAndSyncsTask(t *testing.T) {
	h, _ := newTestBoardHandler()
	state := model.NewBoardState()

	if _, err := h.executeCommand(state, h.taskRepo, nil, "task.create_blank", map[string]any{
		"x": float64(120),
		"y": float64(220),
	}); err != nil {
		t.Fatalf("task.create_blank: %v", err)
	}

	var taskCard *model.Card
	for _, c := range state.Cards {
		if c.DefID == "task.blank" {
			taskCard = c
			break
		}
	}
	if taskCard == nil {
		t.Fatalf("expected task.blank card")
	}

	if _, err := h.executeCommand(state, h.taskRepo, nil, "task.set_title", map[string]any{
		"taskCardId": string(taskCard.ID),
		"title":      "Take out trash",
	}); err != nil {
		t.Fatalf("task.set_title: %v", err)
	}

	updated := state.GetCard(taskCard.ID)
	if updated == nil {
		t.Fatalf("updated card missing")
	}
	if updated.DefID != "task.instance" {
		t.Fatalf("expected defID task.instance, got %q", updated.DefID)
	}
	if got, _ := updated.Data["title"].(string); got != "Take out trash" {
		t.Fatalf("expected title to persist on board card, got %q", got)
	}

	taskID, _ := updated.Data["taskId"].(string)
	if taskID == "" {
		t.Fatalf("expected linked task id on board card")
	}
	savedTask, err := h.taskRepo.Get(model.TaskID(taskID))
	if err != nil {
		t.Fatalf("get linked task: %v", err)
	}
	if savedTask.Title != "Take out trash" {
		t.Fatalf("expected linked task title to be synced, got %q", savedTask.Title)
	}
}

func TestCommand_TaskSpawnExistingConsumesCoinAndMarksLive(t *testing.T) {
	playerRepo, err := player.NewFileRepo(t.TempDir())
	if err != nil {
		t.Fatalf("new player repo: %v", err)
	}
	playerRepo = playerRepo.ForUser("u-test")
	if _, err := playerRepo.AddLoot(player.LootCoin, 10); err != nil {
		t.Fatalf("seed coin: %v", err)
	}

	taskRepo := task.NewMemoryRepo()
	inbox := "inbox"
	due := "2026-02-12"
	created, err := taskRepo.Create(model.Task{
		Title:       "Laundry",
		Description: "Do laundry",
		Project:     &inbox,
		DueDate:     &due,
		NextAction:  true,
		Recurrence: &model.Recurrence{
			Type:     "weekly",
			Interval: 1,
		},
		Modifiers: []model.TaskModifierSlot{
			{DefID: "mod.context_filter", Data: map[string]any{}},
		},
	})
	if err != nil {
		t.Fatalf("create task: %v", err)
	}

	h := NewHandler(NewMemoryRepo(), taskRepo, testBoardConfig())
	state := model.NewBoardState()

	if _, err := h.executeCommand(state, taskRepo, playerRepo, "task.spawn_existing", map[string]any{
		"taskId": string(created.ID),
		"x":      float64(300),
		"y":      float64(320),
	}); err != nil {
		t.Fatalf("task.spawn_existing: %v", err)
	}

	var found bool
	var spawnedStack *model.Stack
	for _, c := range state.Cards {
		if c.DefID != "task.instance" {
			continue
		}
		if got, _ := c.Data["taskId"].(string); got == string(created.ID) {
			found = true
			for _, s := range state.Stacks {
				for _, cid := range s.Cards {
					if cid == c.ID {
						spawnedStack = s
						break
					}
				}
				if spawnedStack != nil {
					break
				}
			}
			break
		}
	}
	if !found {
		t.Fatalf("expected spawned task.instance card linked to task %s", created.ID)
	}
	if spawnedStack == nil {
		t.Fatalf("expected spawned stack containing task card")
	}

	defs := map[model.CardDefID]bool{}
	for _, cid := range spawnedStack.Cards {
		c := state.GetCard(cid)
		if c == nil {
			continue
		}
		defs[c.DefID] = true
	}
	if !defs["mod.deadline_pin"] {
		t.Fatalf("expected due-date task to spawn with deadline pin modifier card")
	}
	if !defs["mod.recurring"] && !defs["mod.recurring_contract"] {
		t.Fatalf("expected recurring task to spawn with recurrence modifier card")
	}
	if !defs["mod.next_action"] {
		t.Fatalf("expected next-action task to spawn with next action modifier card")
	}
	if !defs["mod.context_filter"] {
		t.Fatalf("expected explicit task modifiers to be represented on board stack")
	}

	wallet := playerRepo.GetState()
	if got := wallet.Loot[player.LootCoin]; got != 7 {
		t.Fatalf("expected coin to be debited to 7, got %d", got)
	}

	live := true
	liveTasks, err := taskRepo.List(task.ListFilter{Live: &live})
	if err != nil {
		t.Fatalf("list live tasks: %v", err)
	}
	if len(liveTasks) != 1 || liveTasks[0].ID != created.ID {
		t.Fatalf("expected spawned task to be marked live")
	}
}

func TestCommand_TaskSetTaskIDMarksLive(t *testing.T) {
	h, _ := newTestBoardHandler()
	state := model.NewBoardState()

	card := state.CreateCard("task.blank", map[string]any{
		"title":       "From board",
		"description": "Needs link",
	})
	_ = state.CreateStack(model.Point{X: 240, Y: 240}, []model.CardID{card.ID})

	inbox := "inbox"
	created, err := h.taskRepo.Create(model.Task{
		Title:       "From board",
		Description: "Needs link",
		Project:     &inbox,
	})
	if err != nil {
		t.Fatalf("create task: %v", err)
	}

	if _, err := h.executeCommand(state, h.taskRepo, nil, "task.set_task_id", map[string]any{
		"taskCardId": string(card.ID),
		"taskId":     string(created.ID),
	}); err != nil {
		t.Fatalf("task.set_task_id: %v", err)
	}

	updated := state.GetCard(card.ID)
	if updated == nil {
		t.Fatalf("expected task card to still exist")
	}
	if got, _ := updated.Data["taskId"].(string); got != string(created.ID) {
		t.Fatalf("expected taskId to be linked on card data, got %q", got)
	}

	live := true
	liveTasks, err := h.taskRepo.List(task.ListFilter{Live: &live})
	if err != nil {
		t.Fatalf("list live tasks: %v", err)
	}
	if len(liveTasks) != 1 || liveTasks[0].ID != created.ID {
		t.Fatalf("expected linked task to be marked live")
	}
}

func TestCommand_TaskAssignVillagerSyncsTaskAssignment(t *testing.T) {
	h, _ := newTestBoardHandler()
	state := model.NewBoardState()

	if _, err := h.executeCommand(state, h.taskRepo, nil, "task.create_blank", map[string]any{
		"x": float64(180),
		"y": float64(210),
	}); err != nil {
		t.Fatalf("task.create_blank: %v", err)
	}

	taskStackID := ""
	taskID := ""
	for sid, s := range state.Stacks {
		for _, cid := range s.Cards {
			c := state.GetCard(cid)
			if c == nil || c.DefID != "task.blank" {
				continue
			}
			taskStackID = string(sid)
			taskID, _ = c.Data["taskId"].(string)
			break
		}
	}
	if taskStackID == "" || taskID == "" {
		t.Fatalf("expected created task stack and linked task id")
	}

	villager := state.CreateCard("villager.basic", map[string]any{"name": "Pip"})
	villagerStack := state.CreateStack(model.Point{X: 260, Y: 210}, []model.CardID{villager.ID})

	if _, err := h.executeCommand(state, h.taskRepo, nil, "task.assign_villager", map[string]any{
		"taskStackId":     taskStackID,
		"villagerStackId": string(villagerStack.ID),
	}); err != nil {
		t.Fatalf("task.assign_villager: %v", err)
	}

	gotTask, err := h.taskRepo.Get(model.TaskID(taskID))
	if err != nil {
		t.Fatalf("get task: %v", err)
	}
	if gotTask.AssignedVillagerID == nil || *gotTask.AssignedVillagerID == "" {
		t.Fatalf("expected task assignment to be synced into task repo")
	}
}

func TestCommand_TaskAssignVillager_PreservesReceiverPosition(t *testing.T) {
	h, _ := newTestBoardHandler()
	state := model.NewBoardState()

	taskCard := state.CreateCard("task.instance", map[string]any{
		"title": "Inbox task",
	})
	taskStack := state.CreateStack(model.Point{X: 140, Y: 180}, []model.CardID{taskCard.ID})

	villager := state.CreateCard("villager.basic", map[string]any{"name": "Pip"})
	villagerStack := state.CreateStack(model.Point{X: 480, Y: 360}, []model.CardID{villager.ID})

	if _, err := h.executeCommand(state, h.taskRepo, nil, "task.assign_villager", map[string]any{
		"taskStackId":     string(taskStack.ID),
		"villagerStackId": string(villagerStack.ID),
		"targetStackId":   string(villagerStack.ID),
	}); err != nil {
		t.Fatalf("task.assign_villager: %v", err)
	}

	merged := state.GetStack(taskStack.ID)
	if merged == nil {
		t.Fatalf("expected merged task stack to remain")
	}
	if merged.Pos != villagerStack.Pos {
		t.Fatalf("expected merged stack at receiver pos %+v, got %+v", villagerStack.Pos, merged.Pos)
	}
	if state.GetStack(villagerStack.ID) != nil {
		t.Fatalf("expected villager source stack to be removed after merge")
	}
}

func TestCommand_TaskCompleteStack_RemovesTaskAndSingleUseButKeepsVillager(t *testing.T) {
	taskRepo := task.NewMemoryRepo()
	cfg := testBoardConfig()
	cfg.Tasks = config.Tasks{
		Processing: config.TaskProcessing{
			CompletionRequiresAssignedVillager: true,
		},
	}
	cfg.Modifiers.Types = []config.ModifierType{
		{
			ID: "next_action",
			Charges: config.ModifierCharges{
				Mode:       "finite",
				MaxCharges: 1,
				ConsumeOn:  []string{"task_complete"},
			},
		},
		{
			ID: "deadline_pin",
			Charges: config.ModifierCharges{
				Mode:       "infinite",
				MaxCharges: 0,
				ConsumeOn:  []string{},
			},
		},
	}
	h := NewHandler(NewMemoryRepo(), taskRepo, cfg)
	state := model.NewBoardState()

	inbox := "inbox"
	created, err := taskRepo.Create(model.Task{
		Title:   "Trash",
		Project: &inbox,
	})
	if err != nil {
		t.Fatalf("create task: %v", err)
	}
	if err := taskRepo.SetLive(created.ID, true); err != nil {
		t.Fatalf("set live: %v", err)
	}

	villager := state.CreateCard("villager.basic", map[string]any{"name": "Pip"})
	nextAction := state.CreateCard("mod.next_action", nil)
	deadline := state.CreateCard("mod.deadline_pin", nil)
	taskCard := state.CreateCard("task.instance", map[string]any{
		"taskId": string(created.ID),
		"title":  "Trash",
	})
	stack := state.CreateStack(model.Point{X: 300, Y: 300}, []model.CardID{
		villager.ID,
		nextAction.ID,
		deadline.ID,
		taskCard.ID,
	})

	if _, err := h.executeCommand(state, taskRepo, nil, "task.complete_stack", map[string]any{
		"stackId": string(stack.ID),
	}); err != nil {
		t.Fatalf("task.complete_stack: %v", err)
	}

	if state.GetStack(stack.ID) != nil {
		t.Fatalf("expected original completed stack to be removed")
	}
	if state.GetCard(taskCard.ID) != nil {
		t.Fatalf("expected task card to be removed from board")
	}
	if state.GetCard(nextAction.ID) != nil {
		t.Fatalf("expected single-use next action modifier to be removed")
	}
	if state.GetCard(villager.ID) == nil {
		t.Fatalf("expected villager card to remain on board")
	}
	if state.GetCard(deadline.ID) == nil {
		t.Fatalf("expected persistent deadline pin modifier to remain on board")
	}

	updatedTask, err := taskRepo.Get(created.ID)
	if err != nil {
		t.Fatalf("get completed task: %v", err)
	}
	if !updatedTask.Done {
		t.Fatalf("expected completed task to be marked done")
	}
	live := true
	liveTasks, err := taskRepo.List(task.ListFilter{Live: &live})
	if err != nil {
		t.Fatalf("list live tasks: %v", err)
	}
	if len(liveTasks) != 0 {
		t.Fatalf("expected completed task to be removed from live index")
	}
}

func TestCommand_StackMerge_TaskRemainsFaceCard(t *testing.T) {
	h, _ := newTestBoardHandler()
	state := model.NewBoardState()

	taskCard := state.CreateCard("task.blank", map[string]any{"title": "T"})
	taskStack := state.CreateStack(model.Point{X: 100, Y: 100}, []model.CardID{taskCard.ID})
	modCard := state.CreateCard("mod.recurring", nil)
	modStack := state.CreateStack(model.Point{X: 120, Y: 100}, []model.CardID{modCard.ID})

	if _, err := h.executeCommand(state, nil, nil, "stack.merge", map[string]any{
		"targetId": string(taskStack.ID),
		"sourceId": string(modStack.ID),
	}); err != nil {
		t.Fatalf("stack.merge: %v", err)
	}

	merged := state.GetStack(taskStack.ID)
	if merged == nil || len(merged.Cards) != 2 {
		t.Fatalf("expected merged task stack with 2 cards")
	}
	top := state.GetCard(merged.Cards[len(merged.Cards)-1])
	if top == nil {
		t.Fatalf("expected top card")
	}
	if top.DefID != "task.blank" && top.DefID != "task.instance" {
		t.Fatalf("expected task card to remain face card, got %q", top.DefID)
	}
}

func TestCommand_LootCollectStack_BlankTaskRecyclesIntoCoinOrParts(t *testing.T) {
	playerRepo, err := player.NewFileRepo(t.TempDir())
	if err != nil {
		t.Fatalf("new player repo: %v", err)
	}
	playerRepo = playerRepo.ForUser("u-test")

	taskRepo := task.NewMemoryRepo()
	h := NewHandler(NewMemoryRepo(), taskRepo, testBoardConfig())
	state := model.NewBoardState()

	inbox := "inbox"
	created, err := taskRepo.Create(model.Task{
		Title:   "",
		Project: &inbox,
	})
	if err != nil {
		t.Fatalf("create task: %v", err)
	}
	_ = taskRepo.SetLive(created.ID, true)

	card := state.CreateCard("task.blank", map[string]any{
		"taskId": string(created.ID),
	})
	stack := state.CreateStack(model.Point{X: 320, Y: 240}, []model.CardID{card.ID})

	if _, err := h.executeCommand(state, taskRepo, playerRepo, "loot.collect_stack", map[string]any{
		"stackId": string(stack.ID),
	}); err != nil {
		t.Fatalf("loot.collect_stack: %v", err)
	}

	if state.GetStack(stack.ID) != nil {
		t.Fatalf("expected collected stack to be removed")
	}
	wallet := playerRepo.GetState().Loot
	total := wallet[player.LootCoin] + wallet[player.LootParts]
	if total != 1 {
		t.Fatalf("expected one recycled loot, got coin=%d parts=%d", wallet[player.LootCoin], wallet[player.LootParts])
	}

	live := true
	liveTasks, err := taskRepo.List(task.ListFilter{Live: &live})
	if err != nil {
		t.Fatalf("list live tasks: %v", err)
	}
	if len(liveTasks) != 0 {
		t.Fatalf("expected recycled blank task to be marked not live")
	}
}

func TestCommand_LootCollectStack_MultiCardStackIsRejected(t *testing.T) {
	playerRepo, err := player.NewFileRepo(t.TempDir())
	if err != nil {
		t.Fatalf("new player repo: %v", err)
	}
	playerRepo = playerRepo.ForUser("u-test")

	taskRepo := task.NewMemoryRepo()
	h := NewHandler(NewMemoryRepo(), taskRepo, testBoardConfig())
	state := model.NewBoardState()

	taskCard := state.CreateCard("task.blank", map[string]any{"taskId": "task_demo"})
	villagerCard := state.CreateCard("villager.basic", nil)
	stack := state.CreateStack(model.Point{X: 360, Y: 260}, []model.CardID{villagerCard.ID, taskCard.ID})

	_, err = h.executeCommand(state, taskRepo, playerRepo, "loot.collect_stack", map[string]any{
		"stackId": string(stack.ID),
	})
	if err == nil {
		t.Fatalf("expected collecting multi-card stack to fail")
	}
	if state.GetStack(stack.ID) == nil {
		t.Fatalf("stack should remain after failed collect")
	}
}

func TestCommand_LootCollectStack_ModifierSalvagesToLoot(t *testing.T) {
	playerRepo, err := player.NewFileRepo(t.TempDir())
	if err != nil {
		t.Fatalf("new player repo: %v", err)
	}
	playerRepo = playerRepo.ForUser("u-test")

	taskRepo := task.NewMemoryRepo()
	cfg := testBoardConfig()
	cfg.Salvage = config.Salvage{
		Enabled: true,
		SpentModifierToLoot: map[string]config.RNGPool{
			"schedule_token": {
				RNGPool: []config.RNGPoolEntry{
					{Type: "loot", ID: player.LootPaper, Amount: 1, Weight: 10},
					{Type: "none", Weight: 8},
				},
			},
		},
	}
	h := NewHandler(NewMemoryRepo(), taskRepo, cfg)
	state := model.NewBoardState()

	card := state.CreateCard("mod.schedule_token", nil)
	stack := state.CreateStack(model.Point{X: 260, Y: 220}, []model.CardID{card.ID})

	if _, err := h.executeCommand(state, taskRepo, playerRepo, "loot.collect_stack", map[string]any{
		"stackId": string(stack.ID),
	}); err != nil {
		t.Fatalf("loot.collect_stack modifier: %v", err)
	}

	if state.GetStack(stack.ID) != nil {
		t.Fatalf("expected modifier stack to be removed")
	}
	if got := playerRepo.GetState().Loot[player.LootPaper]; got != 1 {
		t.Fatalf("expected paper salvage reward of 1, got %d", got)
	}
}

func TestCommand_LootCollectStack_ResourceRecyclesToParts(t *testing.T) {
	playerRepo, err := player.NewFileRepo(t.TempDir())
	if err != nil {
		t.Fatalf("new player repo: %v", err)
	}
	playerRepo = playerRepo.ForUser("u-test")

	taskRepo := task.NewMemoryRepo()
	h := NewHandler(NewMemoryRepo(), taskRepo, testBoardConfig())
	state := model.NewBoardState()

	card := state.CreateCard("resource.berry_bush", nil)
	stack := state.CreateStack(model.Point{X: 420, Y: 320}, []model.CardID{card.ID})

	if _, err := h.executeCommand(state, taskRepo, playerRepo, "loot.collect_stack", map[string]any{
		"stackId": string(stack.ID),
	}); err != nil {
		t.Fatalf("loot.collect_stack resource: %v", err)
	}

	if state.GetStack(stack.ID) != nil {
		t.Fatalf("expected resource stack to be removed")
	}
	if got := playerRepo.GetState().Loot[player.LootParts]; got != 1 {
		t.Fatalf("expected parts recycle reward of 1, got %d", got)
	}
}

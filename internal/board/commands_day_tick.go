package board

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"donegeon/internal/config"
	"donegeon/internal/model"
	"donegeon/internal/player"
	"donegeon/internal/task"
)

const ymdLayout = "2006-01-02"

// world.end_day {}
func (h *Handler) cmdWorldEndDay(state *model.BoardState, taskRepo task.Repo, playerRepo *player.FileRepo, _ map[string]any) (any, error) {
	if taskRepo == nil {
		return nil, fmt.Errorf("task repository unavailable")
	}

	now := time.Now().In(time.Local)
	tickDate := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).AddDate(0, 0, 1)
	recurrenceSpawnEnabled := h.cfg != nil && h.cfg.World.DayTick.RecurrenceRules.SpawnIfDue

	allTasks, err := taskRepo.List(task.ListFilter{Status: "all"})
	if err != nil {
		return nil, fmt.Errorf("failed to list tasks: %w", err)
	}

	workedTodayCleared := 0
	recurrenceRespawnedTaskIDs := make([]string, 0)

	for _, t := range allTasks {
		var patch task.Patch
		needsUpdate := false
		respawned := false

		if t.WorkedToday {
			worked := false
			patch.WorkedToday = &worked
			needsUpdate = true
			workedTodayCleared++
		}

		if recurrenceSpawnEnabled && t.Done && t.Recurrence != nil {
			nextDue := nextRecurrenceDueDate(t, tickDate)
			done := false
			patch.Done = &done
			patch.DueDate = &nextDue
			needsUpdate = true
			respawned = true
		}

		if !needsUpdate {
			continue
		}

		if _, err := taskRepo.Update(t.ID, patch); err != nil {
			return nil, fmt.Errorf("failed to update task %s during day tick: %w", t.ID, err)
		}
		if respawned {
			_ = taskRepo.SetLive(t.ID, false)
			recurrenceRespawnedTaskIDs = append(recurrenceRespawnedTaskIDs, string(t.ID))
		}
	}

	pendingTasks, err := taskRepo.List(task.ListFilter{Status: "pending"})
	if err != nil {
		return nil, fmt.Errorf("failed to list pending tasks: %w", err)
	}
	overdueTaskIDs := make([]string, 0)
	graceHours := h.taskDueGraceHours()
	for _, t := range pendingTasks {
		if isTaskOverdueAtTick(t, tickDate, graceHours) {
			overdueTaskIDs = append(overdueTaskIDs, string(t.ID))
		}
	}

	spawnedZombieStacks := h.spawnOverdueZombies(state, overdueTaskIDs)

	staminaResetVillagers := 0
	if h.cfg != nil && h.cfg.World.DayTick.StaminaReset.Enabled && playerRepo != nil {
		villagerIDs := boardVillagerStackIDs(state)
		if _, err := playerRepo.ResetVillagerStamina(villagerIDs, h.villagerBaseMaxStamina(), h.cfg.World.DayTick.StaminaReset.Mode); err != nil {
			return nil, fmt.Errorf("failed to reset villager stamina: %w", err)
		}
		staminaResetVillagers = len(villagerIDs)
	}

	sort.Strings(recurrenceRespawnedTaskIDs)
	sort.Strings(overdueTaskIDs)

	return map[string]any{
		"tickDate":                   tickDate.Format(ymdLayout),
		"workedTodayCleared":         workedTodayCleared,
		"recurrenceRespawnedTaskIds": recurrenceRespawnedTaskIDs,
		"overdueTaskCount":           len(overdueTaskIDs),
		"overdueTaskIds":             overdueTaskIDs,
		"spawnedZombieCount":         len(spawnedZombieStacks),
		"spawnedZombieStacks":        spawnedZombieStacks,
		"staminaResetVillagers":      staminaResetVillagers,
	}, nil
}

// zombie.clear { zombieStackId, villagerStackId, targetStackId? }
func (h *Handler) cmdZombieClear(state *model.BoardState, playerRepo *player.FileRepo, args map[string]any) (any, error) {
	if playerRepo == nil {
		return nil, fmt.Errorf("player repository unavailable")
	}

	zombieStackID, err := getString(args, "zombieStackId")
	if err != nil {
		return nil, err
	}
	villagerStackID, err := getString(args, "villagerStackId")
	if err != nil {
		return nil, err
	}
	targetStackID, err := getStringOr(args, "targetStackId")
	if err != nil {
		return nil, err
	}
	if targetStackID != "" && targetStackID != zombieStackID && targetStackID != villagerStackID {
		return nil, fmt.Errorf("targetStackId must match zombie or villager stack")
	}

	zombieStack := state.GetStack(model.StackID(zombieStackID))
	if zombieStack == nil {
		return nil, fmt.Errorf("zombie stack not found: %s", zombieStackID)
	}
	villagerStack := state.GetStack(model.StackID(villagerStackID))
	if villagerStack == nil {
		return nil, fmt.Errorf("villager stack not found: %s", villagerStackID)
	}

	if !stackHasKind(state, zombieStack, "zombie") {
		return nil, fmt.Errorf("stack is not a zombie stack: %s", zombieStackID)
	}
	if !stackHasKind(state, villagerStack, "villager") {
		return nil, fmt.Errorf("stack is not a villager stack: %s", villagerStackID)
	}

	staminaCost := h.zombieClearStaminaCost()
	ok, staminaRemaining, _, err := playerRepo.SpendVillagerStamina(villagerStackID, staminaCost, h.villagerBaseMaxStamina())
	if err != nil {
		return nil, fmt.Errorf("failed to spend villager stamina: %w", err)
	}
	if !ok {
		return nil, fmt.Errorf("villager stamina too low (need %d)", staminaCost)
	}

	zombiePos := zombieStack.Pos
	removedZombieCards := make([]string, 0)
	kept := make([]model.CardID, 0, len(zombieStack.Cards))
	for _, cid := range zombieStack.Cards {
		card := state.GetCard(cid)
		if card == nil {
			continue
		}
		if extractKind(card.DefID) == "zombie" {
			state.RemoveCard(cid)
			removedZombieCards = append(removedZombieCards, string(cid))
			continue
		}
		kept = append(kept, cid)
	}

	if len(kept) == 0 {
		state.RemoveStack(model.StackID(zombieStackID))
	} else {
		zombieStack.Cards = kept
		ensureTaskFaceCard(state, zombieStack)
	}

	if targetStackID == zombieStackID && zombieStackID != villagerStackID {
		villagerStack.Pos = zombiePos
	}

	rewardType, rewardAmount := h.zombieClearReward()
	var inventory map[string]int
	if rewardType != "" && rewardAmount > 0 {
		wallet, err := playerRepo.AddLoot(rewardType, rewardAmount)
		if err != nil {
			return nil, fmt.Errorf("failed to grant zombie clear reward: %w", err)
		}
		inventory = wallet.Loot
	} else {
		inventory = playerRepo.GetState().Loot
	}

	return map[string]any{
		"removedZombieStack": zombieStackID,
		"removedZombieCards": removedZombieCards,
		"villagerStackId":    villagerStackID,
		"staminaCost":        staminaCost,
		"staminaRemaining":   staminaRemaining,
		"reward": map[string]any{
			"type":   rewardType,
			"amount": rewardAmount,
		},
		"inventory": inventory,
	}, nil
}

func (h *Handler) villagerBaseMaxStamina() int {
	if h.cfg == nil {
		return 6
	}
	if h.cfg.Villagers.Defaults.BaseMaxStamina <= 0 {
		return 6
	}
	return h.cfg.Villagers.Defaults.BaseMaxStamina
}

func (h *Handler) taskDueGraceHours() int {
	if h.cfg == nil {
		return 0
	}
	if h.cfg.Tasks.DueDate.GraceHours < 0 {
		return 0
	}
	return h.cfg.Tasks.DueDate.GraceHours
}

func (h *Handler) zombieClearStaminaCost() int {
	cost := 2
	minCost := 1

	if h.cfg != nil {
		if c := h.cfg.Villagers.Actions.ClearZombie.StaminaCost; c > 0 {
			cost = c
		}
		if len(h.cfg.Zombies.Types) > 0 {
			if c := h.cfg.Zombies.Types[0].Cleanup.StaminaCost; c > 0 {
				cost = c
			}
		}
		if m := h.cfg.Villagers.Actions.ClearZombie.MinCostAfterPerks; m > 0 {
			minCost = m
		}
	}
	if cost < minCost {
		cost = minCost
	}
	if cost <= 0 {
		return 1
	}
	return cost
}

func (h *Handler) zombieClearReward() (string, int) {
	if h.cfg == nil || len(h.cfg.Zombies.Types) == 0 {
		return player.LootCoin, 1
	}
	return dominantLootFromPool(h.cfg.Zombies.Types[0].Cleanup.RewardOnClear.RNGPool, player.LootCoin, 1)
}

func dominantLootFromPool(pool []config.RNGPoolEntry, fallbackType string, fallbackAmount int) (string, int) {
	bestLoot := ""
	bestAmount := 0
	bestWeight := -1
	for _, entry := range pool {
		if entry.Type != "loot" {
			continue
		}
		lootType := normalizeCollectLoot(strings.TrimSpace(entry.ID))
		if lootType == "" {
			continue
		}
		if entry.Weight > bestWeight {
			bestWeight = entry.Weight
			bestLoot = lootType
			if entry.Amount > 0 {
				bestAmount = entry.Amount
			} else {
				bestAmount = 1
			}
		}
	}
	if bestLoot != "" && bestAmount > 0 {
		return bestLoot, bestAmount
	}
	if fallbackType == "" || fallbackAmount <= 0 {
		return "", 0
	}
	return fallbackType, fallbackAmount
}

func boardVillagerStackIDs(state *model.BoardState) []string {
	out := make([]string, 0)
	for sid, stack := range state.Stacks {
		if stackHasKind(state, stack, "villager") {
			out = append(out, string(sid))
		}
	}
	sort.Strings(out)
	return out
}

func stackHasKind(state *model.BoardState, stack *model.Stack, kind string) bool {
	if state == nil || stack == nil {
		return false
	}
	for _, cid := range stack.Cards {
		card := state.GetCard(cid)
		if card == nil {
			continue
		}
		if extractKind(card.DefID) == kind {
			return true
		}
	}
	return false
}

func isTaskOverdueAtTick(t model.Task, tickDate time.Time, graceHours int) bool {
	if t.Done || t.DueDate == nil {
		return false
	}
	raw := strings.TrimSpace(*t.DueDate)
	if raw == "" {
		return false
	}
	dueDate, err := time.ParseInLocation(ymdLayout, raw, time.Local)
	if err != nil {
		return false
	}
	if graceHours > 0 {
		dueDate = dueDate.Add(time.Duration(graceHours) * time.Hour)
	}
	return dueDate.Before(tickDate)
}

func addRecurrence(base time.Time, recurrence *model.Recurrence) time.Time {
	if recurrence == nil {
		return base
	}
	interval := recurrence.Interval
	if interval <= 0 {
		interval = 1
	}
	switch strings.ToLower(strings.TrimSpace(recurrence.Type)) {
	case "weekly":
		return base.AddDate(0, 0, 7*interval)
	case "monthly":
		return base.AddDate(0, interval, 0)
	case "daily", "":
		return base.AddDate(0, 0, interval)
	default:
		return base.AddDate(0, 0, interval)
	}
}

func nextRecurrenceDueDate(t model.Task, tickDate time.Time) string {
	next := tickDate
	if t.DueDate != nil {
		if parsed, err := time.ParseInLocation(ymdLayout, strings.TrimSpace(*t.DueDate), time.Local); err == nil {
			next = parsed
		}
	}
	for next.Before(tickDate) {
		next = addRecurrence(next, t.Recurrence)
	}
	return next.Format(ymdLayout)
}

func (h *Handler) spawnOverdueZombies(state *model.BoardState, overdueTaskIDs []string) []*model.Stack {
	if len(overdueTaskIDs) == 0 {
		return nil
	}

	spawnEnabled := true
	perOverdueTask := 1
	spawnCap := 0
	startX, startY, dx := 1500, 150, 150
	zombieDefID := model.CardDefID("zombie.default_zombie")

	if h.cfg != nil {
		spawnEnabled = h.cfg.World.DayTick.OverdueRules.ZombieSpawn.Enabled
		if v := h.cfg.World.DayTick.OverdueRules.ZombieSpawn.PerOverdueTask; v > 0 {
			perOverdueTask = v
		}
		if v := h.cfg.World.DayTick.OverdueRules.ZombieSpawn.CapPerDay; v > 0 {
			spawnCap = v
		}
		if v := h.cfg.World.DayTick.MaxZombiesSpawnPerDay; v > 0 && (spawnCap == 0 || v < spawnCap) {
			spawnCap = v
		}
		if layout := h.cfg.UIHints.Board.DefaultSpawnLayout.Zombies; layout.StartX != 0 || layout.StartY != 0 || layout.DX != 0 {
			if layout.StartX != 0 {
				startX = layout.StartX
			}
			if layout.StartY != 0 {
				startY = layout.StartY
			}
			if layout.DX != 0 {
				dx = layout.DX
			}
		}
		if len(h.cfg.Zombies.Types) > 0 && strings.TrimSpace(h.cfg.Zombies.Types[0].ID) != "" {
			zombieDefID = model.CardDefID("zombie." + strings.TrimSpace(h.cfg.Zombies.Types[0].ID))
		}
	}
	if !spawnEnabled {
		return nil
	}
	if dx == 0 {
		dx = 120
	}

	desired := len(overdueTaskIDs) * perOverdueTask
	if desired <= 0 {
		return nil
	}
	if spawnCap > 0 && desired > spawnCap {
		desired = spawnCap
	}

	existing := countZombieStacks(state)
	spawned := make([]*model.Stack, 0, desired)
	for i := 0; i < desired; i++ {
		taskID := overdueTaskIDs[i%len(overdueTaskIDs)]
		stack := h.createSingleCardStack(
			state,
			zombieDefID,
			model.Point{
				X: startX + ((existing + i) * dx),
				Y: startY,
			},
			map[string]any{
				"reason": "overdue_task",
				"taskId": taskID,
			},
		)
		spawned = append(spawned, stack)
	}
	return spawned
}

func countZombieStacks(state *model.BoardState) int {
	count := 0
	for _, stack := range state.Stacks {
		if stackHasKind(state, stack, "zombie") {
			count++
		}
	}
	return count
}

package board

import (
	"fmt"
	"strings"
	"time"

	"donegeon/internal/model"
	"donegeon/internal/player"
	"donegeon/internal/task"
)

// task.set_task_id { taskCardId, taskId }
func (h *Handler) cmdTaskSetTaskID(state *model.BoardState, taskRepo task.Repo, args map[string]any) (any, error) {
	cardID, err := getString(args, "taskCardId")
	if err != nil {
		return nil, err
	}
	taskID, err := getString(args, "taskId")
	if err != nil {
		return nil, err
	}

	card := state.GetCard(model.CardID(cardID))
	if card == nil {
		return nil, fmt.Errorf("card not found: %s", cardID)
	}
	if extractKind(card.DefID) != "task" {
		return nil, fmt.Errorf("card is not a task: %s", cardID)
	}
	if card.Data == nil {
		card.Data = map[string]any{}
	}
	card.DefID = "task.instance"
	card.Data["taskId"] = strings.TrimSpace(taskID)

	if taskRepo != nil {
		if strings.TrimSpace(taskID) != "" {
			_ = taskRepo.SetLive(model.TaskID(taskID), true)
		}
	}

	return map[string]any{
		"card":   card,
		"taskId": taskID,
	}, nil
}

// task.complete_by_task_id { taskId }
func (h *Handler) cmdTaskCompleteByTaskID(state *model.BoardState, taskRepo task.Repo, playerRepo *player.FileRepo, args map[string]any) (any, error) {
	taskID, err := getString(args, "taskId")
	if err != nil {
		return nil, err
	}
	taskID = strings.TrimSpace(taskID)
	if taskID == "" {
		return nil, fmt.Errorf("taskId is required")
	}

	for _, stack := range state.Stacks {
		if stack == nil {
			continue
		}
		for _, cid := range stack.Cards {
			card := state.GetCard(cid)
			if card == nil || extractKind(card.DefID) != "task" || card.Data == nil {
				continue
			}
			v, _ := card.Data["taskId"].(string)
			if strings.TrimSpace(v) != taskID {
				continue
			}
			return h.cmdTaskCompleteStack(state, taskRepo, playerRepo, map[string]any{
				"stackId": string(stack.ID),
			})
		}
	}

	// Fallback: if the task card isn't on the board anymore, keep task state consistent.
	if taskRepo != nil {
		done := true
		patch := task.Patch{Done: &done}
		habitBonusCoin := 0
		if cur, err := taskRepo.Get(model.TaskID(taskID)); err == nil && !cur.Done {
			habitPatch, habitResult := task.BuildHabitCompletionUpdate(cur, time.Now())
			patch.CompletionCountDelta = habitPatch.CompletionCountDelta
			patch.Habit = habitPatch.Habit
			patch.HabitTier = habitPatch.HabitTier
			patch.HabitStreak = habitPatch.HabitStreak
			patch.LastCompletedDate = habitPatch.LastCompletedDate
			habitBonusCoin = habitResult.BonusCoin
		}
		if _, err := taskRepo.Update(model.TaskID(taskID), patch); err != nil {
			return nil, err
		}
		_ = taskRepo.SetLive(model.TaskID(taskID), false)
		if habitBonusCoin > 0 && playerRepo != nil {
			_, _ = playerRepo.AddLoot(player.LootCoin, habitBonusCoin)
		}
	}

	return map[string]any{
		"completedTaskId": taskID,
		"mode":            "repo_only",
	}, nil
}

// task.complete_stack { stackId }
func (h *Handler) cmdTaskCompleteStack(state *model.BoardState, taskRepo task.Repo, playerRepo *player.FileRepo, args map[string]any) (any, error) {
	stackID, err := getString(args, "stackId")
	if err != nil {
		return nil, err
	}

	stack := state.GetStack(model.StackID(stackID))
	if stack == nil {
		return nil, fmt.Errorf("stack not found: %s", stackID)
	}
	if len(stack.Cards) == 0 {
		return nil, fmt.Errorf("stack has no cards: %s", stackID)
	}

	taskID := ""
	villagerID := ""
	hasVillager := false
	taskCards := 0
	for _, cid := range stack.Cards {
		c := state.GetCard(cid)
		if c == nil {
			continue
		}
		kind := extractKind(c.DefID)
		if kind == "task" {
			taskCards++
			if taskID == "" && c.Data != nil {
				if v, ok := c.Data["taskId"].(string); ok {
					taskID = strings.TrimSpace(v)
				}
				if v, ok := c.Data["assignedVillagerId"].(string); ok {
					villagerID = strings.TrimSpace(v)
				}
			}
		}
		if kind == "villager" {
			hasVillager = true
		}
	}
	if taskCards == 0 {
		return nil, fmt.Errorf("stack has no task card: %s", stackID)
	}

	requireAssigned := h.cfg != nil && h.cfg.Tasks.Processing.CompletionRequiresAssignedVillager
	if requireAssigned && !hasVillager {
		return nil, fmt.Errorf("task completion requires an assigned villager")
	}

	basePos := stack.Pos
	offset := 18
	removedCards := make([]string, 0, len(stack.Cards))
	survivorCards := make([]model.CardID, 0, len(stack.Cards))

	for _, cid := range stack.Cards {
		c := state.GetCard(cid)
		if c == nil {
			continue
		}
		kind := extractKind(c.DefID)

		remove := false
		switch kind {
		case "task":
			remove = true
		case "modifier":
			remove = h.modifierSingleUseOnTaskComplete(c.DefID)
		}

		if remove {
			state.RemoveCard(cid)
			removedCards = append(removedCards, string(cid))
			continue
		}
		survivorCards = append(survivorCards, cid)
	}

	state.RemoveStack(model.StackID(stackID))

	createdStacks := make([]*model.Stack, 0, len(survivorCards))
	for i, cid := range survivorCards {
		pos := model.Point{
			X: basePos.X + i*offset,
			Y: basePos.Y + i*offset,
		}
		ns := state.CreateStack(pos, []model.CardID{cid})
		createdStacks = append(createdStacks, ns)
	}

	if taskRepo != nil && taskID != "" {
		done := true
		patch := task.Patch{Done: &done}
		habitBonusCoin := 0
		if cur, err := taskRepo.Get(model.TaskID(taskID)); err == nil && !cur.Done {
			habitPatch, habitResult := task.BuildHabitCompletionUpdate(cur, time.Now())
			patch.CompletionCountDelta = habitPatch.CompletionCountDelta
			patch.Habit = habitPatch.Habit
			patch.HabitTier = habitPatch.HabitTier
			patch.HabitStreak = habitPatch.HabitStreak
			patch.LastCompletedDate = habitPatch.LastCompletedDate
			habitBonusCoin = habitResult.BonusCoin
		}
		_, _ = taskRepo.Update(model.TaskID(taskID), patch)
		_ = taskRepo.SetLive(model.TaskID(taskID), false)
		if habitBonusCoin > 0 && playerRepo != nil {
			_, _ = playerRepo.AddLoot(player.LootCoin, habitBonusCoin)
		}
	}

	xpGained := 0
	villagerProgress := player.VillagerProgress{Level: 1}
	awardedPerks := []string{}
	if playerRepo != nil && hasVillager && villagerID != "" {
		xpGained = h.taskCompleteXP()
		if xpGained > 0 {
			vp, newPerks, _, err := h.awardVillagerXP(playerRepo, villagerID, xpGained)
			if err != nil {
				return nil, fmt.Errorf("failed to award task completion XP: %w", err)
			}
			villagerProgress = vp
			awardedPerks = newPerks
		} else {
			villagerProgress = playerRepo.GetVillagerProgress(villagerID)
		}
	}
	if playerRepo != nil {
		_, _, _ = playerRepo.IncrementMetric(player.MetricTasksCompleted, 1)
	}

	return map[string]any{
		"removedStack":      stackID,
		"removedCards":      removedCards,
		"createdStacks":     createdStacks,
		"completedTaskId":   taskID,
		"completionByStack": hasVillager,
		"villagerProgress": map[string]any{
			"id":       villagerID,
			"xp":       villagerProgress.XP,
			"level":    villagerProgress.Level,
			"perks":    villagerProgress.Perks,
			"xpGained": xpGained,
			"newPerks": awardedPerks,
		},
	}, nil
}

func (h *Handler) taskCompleteXP() int {
	if h.cfg == nil {
		return 0
	}
	xp := h.cfg.Villagers.Leveling.XPSources.CompleteTask.BaseXP
	if bonus, ok := h.cfg.Villagers.Leveling.XPSources.CompleteTask.ByPriority["none"]; ok {
		xp += bonus
	}
	if xp < 0 {
		xp = 0
	}
	return xp
}

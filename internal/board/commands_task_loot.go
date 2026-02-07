package board

import (
	"fmt"
	"strings"

	"donegeon/internal/model"
	"donegeon/internal/player"
	"donegeon/internal/task"
)

// task.spawn_existing { taskId, x, y }
func (h *Handler) cmdTaskSpawnExisting(state *model.BoardState, taskRepo task.Repo, playerRepo *player.FileRepo, args map[string]any) (any, error) {
	if taskRepo == nil {
		return nil, fmt.Errorf("task repository unavailable")
	}
	if playerRepo == nil {
		return nil, fmt.Errorf("player repository unavailable")
	}

	taskID, err := getString(args, "taskId")
	if err != nil {
		return nil, err
	}
	x, err := getInt(args, "x")
	if err != nil {
		return nil, err
	}
	y, err := getInt(args, "y")
	if err != nil {
		return nil, err
	}

	t, err := taskRepo.Get(model.TaskID(taskID))
	if err != nil {
		return nil, fmt.Errorf("task not found: %s", taskID)
	}
	if t.Done {
		return nil, fmt.Errorf("cannot move completed task to board")
	}
	if t.Live {
		return nil, fmt.Errorf("task is already on the board")
	}

	ok, wallet, err := playerRepo.SpendLoot(player.LootCoin, player.CostSpawnTaskToBoardCoin)
	if err != nil {
		return nil, fmt.Errorf("failed to spend coin: %w", err)
	}
	if !ok {
		return nil, fmt.Errorf("not enough coin (need %d)", player.CostSpawnTaskToBoardCoin)
	}

	p := ""
	if t.Project != nil {
		p = *t.Project
	}
	card := state.CreateCard("task.instance", map[string]any{
		"taskId":      taskID,
		"title":       t.Title,
		"description": t.Description,
		"done":        t.Done,
		"project":     p,
		"tags":        t.Tags,
		"modifiers":   t.Modifiers,
		"dueDate":     t.DueDate,
		"nextAction":  t.NextAction,
		"recurrence":  t.Recurrence,
	})
	cardIDs := make([]model.CardID, 0, 6)
	for _, spec := range buildSpawnModifierSpecs(t) {
		mod := state.CreateCard(spec.DefID, spec.Data)
		cardIDs = append(cardIDs, mod.ID)
	}
	cardIDs = append(cardIDs, card.ID)
	stack := state.CreateStack(model.Point{X: x, Y: y}, cardIDs)
	ensureTaskFaceCard(state, stack)

	if err := taskRepo.SetLive(model.TaskID(taskID), true); err != nil {
		_, _ = playerRepo.AddLoot(player.LootCoin, player.CostSpawnTaskToBoardCoin)
		return nil, fmt.Errorf("failed to mark task live: %w", err)
	}

	return map[string]any{
		"stack": stack,
		"card":  card,
		"cost": map[string]any{
			"type":   player.LootCoin,
			"amount": player.CostSpawnTaskToBoardCoin,
		},
		"loot": wallet.Loot,
	}, nil
}

func recycleBlankTaskLootType(stackID string) string {
	sum := 0
	for i := 0; i < len(stackID); i++ {
		sum += int(stackID[i])
	}
	// Mostly coin with occasional parts.
	if sum%4 == 0 {
		return player.LootParts
	}
	return player.LootCoin
}

func normalizeCollectLoot(kind string) string {
	switch kind {
	case player.LootCoin, player.LootPaper, player.LootInk, player.LootGear, player.LootParts, player.LootBlueprintShard:
		return kind
	default:
		return ""
	}
}

func (h *Handler) salvageModifierLoot(modDefID, stackID string) (string, int) {
	modifierID := strings.TrimPrefix(modDefID, "mod.")
	if h.cfg != nil && h.cfg.Salvage.Enabled {
		if pool, ok := h.cfg.Salvage.SpentModifierToLoot[modifierID]; ok {
			bestLoot := ""
			bestAmount := 1
			bestWeight := -1
			for _, entry := range pool.RNGPool {
				if entry.Type != "loot" {
					continue
				}
				lootID := normalizeCollectLoot(strings.TrimSpace(entry.ID))
				if lootID == "" {
					continue
				}
				if entry.Weight > bestWeight {
					bestLoot = lootID
					bestWeight = entry.Weight
					if entry.Amount > 0 {
						bestAmount = entry.Amount
					} else {
						bestAmount = 1
					}
				}
			}
			if bestLoot != "" {
				return bestLoot, bestAmount
			}
		}
	}

	// Default salvage for modifiers without explicit config mapping.
	if recycleBlankTaskLootType(stackID) == player.LootCoin {
		return player.LootCoin, 1
	}
	return player.LootParts, 1
}

// loot.collect_stack { stackId }
func (h *Handler) cmdLootCollectStack(state *model.BoardState, taskRepo task.Repo, playerRepo *player.FileRepo, args map[string]any) (any, error) {
	if playerRepo == nil {
		return nil, fmt.Errorf("player repository unavailable")
	}

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
	if len(stack.Cards) != 1 {
		return nil, fmt.Errorf("only single-card stacks can be collected")
	}

	top := state.GetCard(stack.Cards[len(stack.Cards)-1])
	if top == nil {
		return nil, fmt.Errorf("top card not found: %s", stackID)
	}
	defID := string(top.DefID)
	amount := 1
	lootType := ""

	switch {
	case strings.HasPrefix(defID, "loot."):
		lootType = normalizeCollectLoot(strings.TrimPrefix(defID, "loot."))
		if lootType == "" {
			return nil, fmt.Errorf("loot type is not collectible: %s", defID)
		}
		if top.Data != nil {
			if v, ok := top.Data["amount"]; ok {
				switch n := v.(type) {
				case float64:
					if int(n) > 0 {
						amount = int(n)
					}
				case int:
					if n > 0 {
						amount = n
					}
				}
			}
		}
	case defID == "task.blank":
		lootType = recycleBlankTaskLootType(stackID)
	case strings.HasPrefix(defID, "mod."):
		lootType, amount = h.salvageModifierLoot(defID, stackID)
	case strings.HasPrefix(defID, "resource."):
		// Recycle unworked resource cards into crafting material.
		lootType = player.LootParts
	default:
		return nil, fmt.Errorf("stack is not collectible loot: %s", defID)
	}

	for _, cardID := range stack.Cards {
		state.RemoveCard(cardID)
	}
	state.RemoveStack(model.StackID(stackID))
	if taskRepo != nil && top.Data != nil {
		if taskID, ok := top.Data["taskId"].(string); ok && strings.TrimSpace(taskID) != "" {
			_ = taskRepo.SetLive(model.TaskID(taskID), false)
		}
	}

	wallet, err := playerRepo.AddLoot(lootType, amount)
	if err != nil {
		return nil, fmt.Errorf("failed to add loot: %w", err)
	}

	return map[string]any{
		"removedStack": stackID,
		"loot": map[string]any{
			"type":   lootType,
			"amount": amount,
		},
		"inventory": wallet.Loot,
	}, nil
}

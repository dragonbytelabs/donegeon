package board

import (
	"fmt"
	"math/rand"
	"strings"
	"time"

	"donegeon/internal/config"
	"donegeon/internal/model"
	"donegeon/internal/player"
)

// resource.gather { resourceStackId, villagerStackId, targetStackId? }
func (h *Handler) cmdResourceGather(state *model.BoardState, playerRepo *player.FileRepo, args map[string]any) (any, error) {
	if playerRepo == nil {
		return nil, fmt.Errorf("player repository unavailable")
	}

	resourceStackID, err := getString(args, "resourceStackId")
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
	if targetStackID != "" && targetStackID != resourceStackID && targetStackID != villagerStackID {
		return nil, fmt.Errorf("targetStackId must match resource or villager stack")
	}

	resourceStack := state.GetStack(model.StackID(resourceStackID))
	if resourceStack == nil {
		return nil, fmt.Errorf("resource stack not found: %s", resourceStackID)
	}
	villagerStack := state.GetStack(model.StackID(villagerStackID))
	if villagerStack == nil {
		return nil, fmt.Errorf("villager stack not found: %s", villagerStackID)
	}
	if !stackHasKind(state, resourceStack, "resource") {
		return nil, fmt.Errorf("stack is not a resource stack: %s", resourceStackID)
	}
	if !stackHasKind(state, villagerStack, "villager") {
		return nil, fmt.Errorf("stack is not a villager stack: %s", villagerStackID)
	}

	resourceCard := firstCardByKind(state, resourceStack, "resource")
	if resourceCard == nil {
		return nil, fmt.Errorf("resource card not found in stack: %s", resourceStackID)
	}
	resourceID := strings.TrimPrefix(string(resourceCard.DefID), "resource.")
	if strings.TrimSpace(resourceID) == "" {
		return nil, fmt.Errorf("invalid resource card: %s", resourceCard.DefID)
	}

	node := h.findResourceNode(resourceID)
	if node == nil {
		return nil, fmt.Errorf("resource config not found: %s", resourceID)
	}

	cost := h.gatherStartStaminaCost()
	maxStamina := h.villagerMaxStamina(playerRepo, villagerStackID)
	ok, staminaRemaining, _, err := playerRepo.SpendVillagerStamina(villagerStackID, cost, maxStamina)
	if err != nil {
		return nil, fmt.Errorf("failed to spend villager stamina: %w", err)
	}
	if !ok {
		return nil, fmt.Errorf("villager stamina too low (need %d)", cost)
	}

	if resourceCard.Data == nil {
		resourceCard.Data = map[string]any{}
	}
	remainingCharges := intFromAny(resourceCard.Data["charges"])
	if remainingCharges <= 0 {
		remainingCharges = initialResourceCharges(node)
	}
	remainingCharges--

	resourcePos := resourceStack.Pos
	if targetStackID == resourceStackID && villagerStackID != resourceStackID {
		villagerStack.Pos = resourcePos
	}

	if remainingCharges <= 0 {
		removeCardFromStack(state, resourceStack.ID, resourceCard.ID)
	} else {
		resourceCard.Data["charges"] = remainingCharges
	}

	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	createdStacks := make([]*model.Stack, 0, 2)

	productCard, err := h.createResourceProductCard(state, node)
	if err != nil {
		return nil, err
	}
	productStack := state.CreateStack(model.Point{X: resourcePos.X + 24, Y: resourcePos.Y + 10}, []model.CardID{productCard.ID})
	createdStacks = append(createdStacks, productStack)

	if bonusCard := h.createResourceBonusLootCard(state, node, rng); bonusCard != nil {
		bonusStack := state.CreateStack(model.Point{X: resourcePos.X + 48, Y: resourcePos.Y + 24}, []model.CardID{bonusCard.ID})
		createdStacks = append(createdStacks, bonusStack)
	}

	xpGained := h.gatherResourceXP()
	villagerProgress := playerRepo.GetVillagerProgress(villagerStackID)
	newPerks := []string{}
	if xpGained > 0 {
		vp, awarded, _, err := h.awardVillagerXP(playerRepo, villagerStackID, xpGained)
		if err != nil {
			return nil, fmt.Errorf("failed to award gather XP: %w", err)
		}
		villagerProgress = vp
		newPerks = awarded
	}

	return map[string]any{
		"resourceStackId":          resourceStackID,
		"villagerStackId":          villagerStackID,
		"staminaCost":              cost,
		"staminaRemaining":         staminaRemaining,
		"resourceChargesRemaining": maxInt(remainingCharges, 0),
		"resourceDepleted":         remainingCharges <= 0,
		"createdStacks":            createdStacks,
		"villagerProgress": map[string]any{
			"id":       villagerStackID,
			"xp":       villagerProgress.XP,
			"level":    villagerProgress.Level,
			"perks":    villagerProgress.Perks,
			"xpGained": xpGained,
			"newPerks": newPerks,
		},
	}, nil
}

// food.consume { foodStackId, villagerStackId, targetStackId? }
func (h *Handler) cmdFoodConsume(state *model.BoardState, playerRepo *player.FileRepo, args map[string]any) (any, error) {
	if playerRepo == nil {
		return nil, fmt.Errorf("player repository unavailable")
	}

	foodStackID, err := getString(args, "foodStackId")
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
	if targetStackID != "" && targetStackID != foodStackID && targetStackID != villagerStackID {
		return nil, fmt.Errorf("targetStackId must match food or villager stack")
	}

	foodStack := state.GetStack(model.StackID(foodStackID))
	if foodStack == nil {
		return nil, fmt.Errorf("food stack not found: %s", foodStackID)
	}
	villagerStack := state.GetStack(model.StackID(villagerStackID))
	if villagerStack == nil {
		return nil, fmt.Errorf("villager stack not found: %s", villagerStackID)
	}
	if !stackHasKind(state, foodStack, "food") {
		return nil, fmt.Errorf("stack is not a food stack: %s", foodStackID)
	}
	if !stackHasKind(state, villagerStack, "villager") {
		return nil, fmt.Errorf("stack is not a villager stack: %s", villagerStackID)
	}

	foodCard := firstCardByKind(state, foodStack, "food")
	if foodCard == nil {
		return nil, fmt.Errorf("food card not found in stack: %s", foodStackID)
	}
	foodID := strings.TrimPrefix(string(foodCard.DefID), "food.")
	foodCfg := h.findFoodItem(foodID)
	if foodCfg == nil {
		return nil, fmt.Errorf("food config not found: %s", foodID)
	}

	cost := h.eatFoodStaminaCost()
	maxStamina := h.villagerMaxStamina(playerRepo, villagerStackID)
	staminaBefore, _, _ := playerRepo.RestoreVillagerStamina(villagerStackID, 0, maxStamina)
	staminaAfterCost := staminaBefore
	if cost > 0 {
		ok, remaining, _, err := playerRepo.SpendVillagerStamina(villagerStackID, cost, maxStamina)
		if err != nil {
			return nil, fmt.Errorf("failed to spend villager stamina: %w", err)
		}
		if !ok {
			return nil, fmt.Errorf("villager stamina too low (need %d)", cost)
		}
		staminaAfterCost = remaining
	}

	consumeCount := 1
	if foodCard.Data == nil {
		foodCard.Data = map[string]any{}
	}
	amount := intFromAny(foodCard.Data["amount"])
	if amount <= 0 {
		amount = 1
	}
	if amount <= consumeCount {
		removeCardFromStack(state, foodStack.ID, foodCard.ID)
	} else {
		foodCard.Data["amount"] = amount - consumeCount
	}

	restore := foodCfg.StaminaRestore
	if restore <= 0 {
		restore = 1
	}
	staminaRemaining, _, err := playerRepo.RestoreVillagerStamina(villagerStackID, restore*consumeCount, maxStamina)
	if err != nil {
		return nil, fmt.Errorf("failed to restore villager stamina: %w", err)
	}

	if targetStackID == foodStackID && villagerStackID != foodStackID {
		villagerStack.Pos = foodStack.Pos
	}

	return map[string]any{
		"foodStackId":      foodStackID,
		"villagerStackId":  villagerStackID,
		"staminaCost":      cost,
		"staminaBefore":    staminaBefore,
		"staminaAfterCost": staminaAfterCost,
		"staminaRemaining": staminaRemaining,
		"foodConsumed": map[string]any{
			"id":             foodID,
			"amount":         consumeCount,
			"staminaRestore": restore * consumeCount,
		},
	}, nil
}

func (h *Handler) gatherStartStaminaCost() int {
	if h.cfg == nil {
		return 1
	}
	if h.cfg.Villagers.Actions.GatherStart.StaminaCost < 0 {
		return 0
	}
	return h.cfg.Villagers.Actions.GatherStart.StaminaCost
}

func (h *Handler) eatFoodStaminaCost() int {
	if h.cfg == nil {
		return 0
	}
	if h.cfg.Villagers.Actions.EatFood.StaminaCost < 0 {
		return 0
	}
	return h.cfg.Villagers.Actions.EatFood.StaminaCost
}

func (h *Handler) gatherResourceXP() int {
	if h.cfg == nil {
		return 0
	}
	xp := h.cfg.Villagers.Leveling.XPSources.GatherResourceCycle.BaseXP
	if xp < 0 {
		return 0
	}
	return xp
}

func (h *Handler) findResourceNode(id string) *config.ResourceNode {
	if h.cfg == nil {
		return nil
	}
	id = strings.TrimSpace(id)
	for i := range h.cfg.Resources.Nodes {
		if h.cfg.Resources.Nodes[i].ID == id {
			return &h.cfg.Resources.Nodes[i]
		}
	}
	return nil
}

func (h *Handler) findFoodItem(id string) *config.FoodItem {
	if h.cfg == nil {
		return nil
	}
	id = strings.TrimSpace(id)
	for i := range h.cfg.Food.Items {
		if h.cfg.Food.Items[i].ID == id {
			return &h.cfg.Food.Items[i]
		}
	}
	return nil
}

func initialResourceCharges(node *config.ResourceNode) int {
	if node == nil {
		return 1
	}
	if node.Charges.Max > 0 {
		return node.Charges.Max
	}
	if node.Charges.Min > 0 {
		return node.Charges.Min
	}
	return 1
}

func (h *Handler) createResourceProductCard(state *model.BoardState, node *config.ResourceNode) (*model.Card, error) {
	if node == nil {
		return nil, fmt.Errorf("resource node missing")
	}
	produceType := strings.ToLower(strings.TrimSpace(node.Gather.Produces.Type))
	produceID := strings.TrimSpace(node.Gather.Produces.ID)
	if produceType == "" || produceID == "" {
		return nil, fmt.Errorf("resource %s missing produce config", node.ID)
	}
	amount := node.Gather.Produces.Amount
	if amount <= 0 {
		amount = 1
	}
	defID := model.CardDefID(fmt.Sprintf("%s.%s", produceType, produceID))
	data := map[string]any{}
	if amount > 1 {
		data["amount"] = amount
	}
	return state.CreateCard(defID, data), nil
}

func (h *Handler) createResourceBonusLootCard(state *model.BoardState, node *config.ResourceNode, rng *rand.Rand) *model.Card {
	if node == nil || len(node.Gather.LootOnCycle.RNGPool) == 0 || rng == nil {
		return nil
	}
	entry, ok := pickWeightedRNGPoolEntry(node.Gather.LootOnCycle.RNGPool, rng)
	if !ok {
		return nil
	}
	if strings.ToLower(strings.TrimSpace(entry.Type)) != "loot" {
		return nil
	}
	lootID := normalizeCollectLoot(strings.TrimSpace(entry.ID))
	if lootID == "" {
		return nil
	}
	amount := entry.Amount
	if amount <= 0 {
		amount = 1
	}
	data := map[string]any{}
	if amount > 1 {
		data["amount"] = amount
	}
	return state.CreateCard(model.CardDefID("loot."+lootID), data)
}

func pickWeightedRNGPoolEntry(pool []config.RNGPoolEntry, rng *rand.Rand) (config.RNGPoolEntry, bool) {
	total := 0
	for _, e := range pool {
		if e.Weight > 0 {
			total += e.Weight
		}
	}
	if total <= 0 {
		return config.RNGPoolEntry{}, false
	}
	pick := rng.Intn(total)
	running := 0
	for _, e := range pool {
		if e.Weight <= 0 {
			continue
		}
		running += e.Weight
		if pick < running {
			return e, true
		}
	}
	return config.RNGPoolEntry{}, false
}

func firstCardByKind(state *model.BoardState, stack *model.Stack, kind string) *model.Card {
	if state == nil || stack == nil {
		return nil
	}
	for i := len(stack.Cards) - 1; i >= 0; i-- {
		card := state.GetCard(stack.Cards[i])
		if card == nil {
			continue
		}
		if extractKind(card.DefID) == kind {
			return card
		}
	}
	return nil
}

func removeCardFromStack(state *model.BoardState, stackID model.StackID, cardID model.CardID) {
	stack := state.GetStack(stackID)
	if stack == nil {
		return
	}
	next := make([]model.CardID, 0, len(stack.Cards))
	for _, cid := range stack.Cards {
		if cid == cardID {
			continue
		}
		next = append(next, cid)
	}
	state.RemoveCard(cardID)
	if len(next) == 0 {
		state.RemoveStack(stackID)
		return
	}
	stack.Cards = next
	ensureTaskFaceCard(state, stack)
}

func maxInt(a, b int) int {
	if a >= b {
		return a
	}
	return b
}

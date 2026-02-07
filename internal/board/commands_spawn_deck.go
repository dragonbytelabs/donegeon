package board

import (
	"fmt"
	"hash/fnv"
	"math"
	"math/rand"
	"strings"
	"time"

	"donegeon/internal/config"
	"donegeon/internal/model"
	"donegeon/internal/player"
	"donegeon/internal/task"
)

type drawnCard struct {
	defID model.CardDefID
	data  map[string]any
}

// board.seed_default { deckRowY? }
func (h *Handler) cmdBoardSeedDefault(state *model.BoardState, args map[string]any) (any, error) {
	if len(state.Stacks) > 0 {
		return map[string]any{
			"seeded": false,
			"reason": "already_initialized",
		}, nil
	}

	deckY := getIntOr(args, "deckRowY", 500)
	deckStartX := 60
	deckSpacing := 110

	created := make([]*model.Stack, 0, 6)
	created = append(created, h.createSingleCardStack(state, "deck.first_day", model.Point{X: deckStartX, Y: deckY}, nil))
	created = append(created, h.createSingleCardStack(state, "deck.collect", model.Point{X: deckStartX + deckSpacing, Y: deckY}, nil))
	created = append(created, h.createSingleCardStack(state, "deck.organization", model.Point{X: deckStartX + deckSpacing*2, Y: deckY}, nil))
	created = append(created, h.createSingleCardStack(state, "deck.survival", model.Point{X: deckStartX + deckSpacing*3, Y: deckY}, nil))

	created = append(created, h.createSingleCardStack(state, "villager.basic", model.Point{X: 300, Y: 200}, map[string]any{"name": "Flicker"}))
	created = append(created, h.createSingleCardStack(state, "villager.basic", model.Point{X: 420, Y: 200}, map[string]any{"name": "Pip"}))

	return map[string]any{
		"seeded":  true,
		"created": created,
	}, nil
}

// card.spawn { defId, x, y, data? }
func (h *Handler) cmdCardSpawn(state *model.BoardState, args map[string]any) (any, error) {
	defID, err := getString(args, "defId")
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

	data := map[string]any{}
	if raw, ok := args["data"]; ok {
		if raw == nil {
			data = map[string]any{}
		} else {
			m, ok := raw.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("field data must be an object")
			}
			data = m
		}
	}

	stack := h.createSingleCardStack(state, model.CardDefID(defID), model.Point{X: x, Y: y}, data)
	top := state.GetCard(stack.Cards[len(stack.Cards)-1])
	return map[string]any{
		"stack": stack,
		"card":  top,
	}, nil
}

// deck.spawn_pack { deckStackId, x, y, packDefId? }
func (h *Handler) cmdDeckSpawnPack(state *model.BoardState, args map[string]any) (any, error) {
	deckStackID, err := getString(args, "deckStackId")
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
	packDefID := model.CardDefID("deck.first_day_pack")
	if raw, ok := args["packDefId"]; ok {
		v, ok := raw.(string)
		if !ok {
			return nil, fmt.Errorf("field packDefId must be a string")
		}
		v = strings.TrimSpace(v)
		if v != "" {
			packDefID = model.CardDefID(v)
		}
	}

	deckStack := state.GetStack(model.StackID(deckStackID))
	if deckStack == nil {
		return nil, fmt.Errorf("stack not found: %s", deckStackID)
	}
	if len(deckStack.Cards) == 0 {
		return nil, fmt.Errorf("stack has no cards: %s", deckStackID)
	}
	top := state.GetCard(deckStack.Cards[len(deckStack.Cards)-1])
	if top == nil {
		return nil, fmt.Errorf("top card not found: %s", deckStackID)
	}
	if !strings.HasPrefix(string(top.DefID), "deck.") {
		return nil, fmt.Errorf("stack is not a deck: %s", deckStackID)
	}

	stack := h.createSingleCardStack(state, packDefID, model.Point{X: x, Y: y}, map[string]any{
		"deckId": string(top.DefID),
	})
	packCard := state.GetCard(stack.Cards[len(stack.Cards)-1])
	return map[string]any{
		"stack": stack,
		"card":  packCard,
	}, nil
}

// deck.open_pack { packStackId, deckId, radius?, seed? }
func (h *Handler) cmdDeckOpenPack(state *model.BoardState, taskRepo task.Repo, playerRepo *player.FileRepo, args map[string]any) (any, error) {
	packStackID, err := getString(args, "packStackId")
	if err != nil {
		return nil, err
	}
	deckID, err := getString(args, "deckId")
	if err != nil {
		return nil, err
	}

	packStack := state.GetStack(model.StackID(packStackID))
	if packStack == nil {
		return nil, fmt.Errorf("stack not found: %s", packStackID)
	}
	if len(packStack.Cards) == 0 {
		return nil, fmt.Errorf("stack has no cards: %s", packStackID)
	}
	top := state.GetCard(packStack.Cards[len(packStack.Cards)-1])
	if top == nil {
		return nil, fmt.Errorf("top card not found: %s", packStackID)
	}
	if !strings.HasSuffix(string(top.DefID), "_pack") {
		return nil, fmt.Errorf("stack is not a pack: %s", packStackID)
	}
	if top.Data != nil {
		if fromPack, ok := top.Data["deckId"].(string); ok && strings.TrimSpace(fromPack) != "" {
			fromPack = strings.TrimSpace(fromPack)
			if strings.TrimSpace(deckID) == "" {
				deckID = fromPack
			}
			if strings.TrimSpace(deckID) != fromPack {
				return nil, fmt.Errorf("pack belongs to %s, not %s", fromPack, deckID)
			}
		}
	}

	deckCfg := h.findDeckConfig(deckID)
	if deckCfg == nil {
		return nil, fmt.Errorf("deck not found in config: %s", deckID)
	}
	if deckCfg.Draws.Count <= 0 {
		return nil, fmt.Errorf("deck has invalid draw count: %s", deckID)
	}
	if len(deckCfg.Draws.RNGPool) == 0 {
		return nil, fmt.Errorf("deck has empty rng_pool: %s", deckID)
	}
	if unlocked, reason := h.isDeckUnlocked(deckCfg, taskRepo, playerRepo); !unlocked {
		return nil, fmt.Errorf("deck is locked: %s", reason)
	}

	radius := getIntOr(args, "radius", 170)
	if radius <= 0 {
		radius = 170
	}
	seedArg, err := getIntPtr(args, "seed")
	if err != nil {
		return nil, err
	}

	zombieCount := countZombieStacks(state)
	overrunLevel := 0
	if playerRepo != nil {
		overrunLevel = playerRepo.GetMetric(player.MetricOverrunLevel)
	}
	openCost := h.deckOpenCost(deckCfg, zombieCount, overrunLevel)
	coinsCharged := 0
	freeOpenUsed := false
	deckOpenCount := 0
	inventory := map[string]int{}

	if playerRepo != nil {
		deckOpenCount = playerRepo.GetDeckOpenCount(deckCfg.ID)
		freeOpenUsed = deckOpenCount < deckCfg.FreeOpens
		coinsCharged = openCost
		if freeOpenUsed {
			coinsCharged = 0
		}
		if coinsCharged > 0 {
			ok, wallet, err := playerRepo.SpendLoot(player.LootCoin, coinsCharged)
			if err != nil {
				return nil, fmt.Errorf("failed to spend coin for deck open: %w", err)
			}
			if !ok {
				return nil, fmt.Errorf("not enough coin for deck open (need %d)", coinsCharged)
			}
			inventory = wallet.Loot
		}
	}
	rng := h.newDeckRand(state, deckID, packStackID, seedArg)

	drawn := make([]drawnCard, 0, deckCfg.Draws.Count)
	for i := 0; i < deckCfg.Draws.Count; i++ {
		entry, err := pickWeightedDeckEntry(deckCfg.Draws.RNGPool, rng)
		if err != nil {
			return nil, err
		}
		mapped, err := mapDeckEntryToCard(entry)
		if err != nil {
			return nil, err
		}
		drawn = append(drawn, mapped)
	}

	origin := packStack.Pos
	created := make([]*model.Stack, 0, len(drawn))
	n := len(drawn)
	for i, c := range drawn {
		angle := (-math.Pi / 2) + (float64(i)/float64(n))*(math.Pi*2)
		x := origin.X + int(math.Cos(angle)*float64(radius))
		y := origin.Y + int(math.Sin(angle)*(float64(radius)*0.72))
		stack := h.createSingleCardStack(state, c.defID, model.Point{X: x, Y: y}, c.data)
		created = append(created, stack)
	}

	for _, cardID := range packStack.Cards {
		state.RemoveCard(cardID)
	}
	state.RemoveStack(model.StackID(packStackID))

	if playerRepo != nil {
		nextOpenCount, wallet, err := playerRepo.IncrementDeckOpen(deckCfg.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to update deck open count: %w", err)
		}
		deckOpenCount = nextOpenCount
		if len(inventory) == 0 {
			inventory = wallet.Loot
		}
	}

	return map[string]any{
		"removedStack":  packStackID,
		"createdStacks": created,
		"deck": map[string]any{
			"id":            deckCfg.ID,
			"costCharged":   coinsCharged,
			"baseCost":      deckCfg.BaseCost,
			"freeOpenUsed":  freeOpenUsed,
			"deckOpenCount": deckOpenCount,
		},
		"inventory": inventory,
	}, nil
}

func (h *Handler) createSingleCardStack(state *model.BoardState, defID model.CardDefID, pos model.Point, data map[string]any) *model.Stack {
	card := state.CreateCard(defID, data)
	return state.CreateStack(pos, []model.CardID{card.ID})
}

func (h *Handler) findDeckConfig(deckID string) *config.Deck {
	if h.cfg == nil {
		return nil
	}
	for i := range h.cfg.Decks.List {
		if h.cfg.Decks.List[i].ID == deckID {
			return &h.cfg.Decks.List[i]
		}
	}
	return nil
}

func (h *Handler) isDeckUnlocked(deckCfg *config.Deck, taskRepo task.Repo, playerRepo *player.FileRepo) (bool, string) {
	if deckCfg == nil {
		return false, "deck config missing"
	}
	status := strings.ToLower(strings.TrimSpace(deckCfg.Status))
	if status == "" || status == "unlocked" {
		return true, ""
	}
	if len(deckCfg.UnlockCondition) == 0 {
		return false, "unlock condition not met"
	}

	condType, _ := deckCfg.UnlockCondition["type"].(string)
	condType = strings.TrimSpace(strings.ToLower(condType))
	switch condType {
	case "", "always":
		return true, ""
	case "processed_tasks_gte":
		need := intFromAny(deckCfg.UnlockCondition["value"])
		if need <= 0 {
			return true, ""
		}
		processed := 0
		if taskRepo != nil {
			tasks, err := taskRepo.List(task.ListFilter{Status: "all"})
			if err == nil {
				for _, t := range tasks {
					processed += t.ProcessedCount
				}
			}
		}
		if processed >= need {
			return true, ""
		}
		return false, fmt.Sprintf("processed tasks %d/%d", processed, need)
	case "zombies_seen_gte":
		need := intFromAny(deckCfg.UnlockCondition["value"])
		if need <= 0 {
			return true, ""
		}
		seen := 0
		if playerRepo != nil {
			seen = playerRepo.GetMetric(player.MetricZombiesSeen)
		}
		if seen >= need {
			return true, ""
		}
		return false, fmt.Sprintf("zombies seen %d/%d", seen, need)
	default:
		return false, fmt.Sprintf("unsupported unlock condition: %s", condType)
	}
}

func (h *Handler) deckOpenCost(deckCfg *config.Deck, zombieCount, overrunLevel int) int {
	if deckCfg == nil || deckCfg.BaseCost <= 0 {
		return 0
	}
	zMult := 0.0
	oMult := 0.0
	if h.cfg != nil {
		zMult = h.cfg.Decks.Economy.ZombieCostMultiplierPerZombie
		oMult = h.cfg.Decks.Economy.OverrunCostMultiplierPerLevel
	}
	factor := 1.0 + (float64(zombieCount) * zMult) + (float64(overrunLevel) * oMult)
	if factor < 0 {
		factor = 0
	}
	return int(math.Ceil(float64(deckCfg.BaseCost) * factor))
}

func intFromAny(v any) int {
	switch n := v.(type) {
	case int:
		return n
	case int64:
		return int(n)
	case float64:
		return int(n)
	case float32:
		return int(n)
	case string:
		n = strings.TrimSpace(n)
		if n == "" {
			return 0
		}
		var out int
		_, _ = fmt.Sscanf(n, "%d", &out)
		return out
	default:
		return 0
	}
}

func (h *Handler) newDeckRand(state *model.BoardState, deckID, packStackID string, seedArg *int) *rand.Rand {
	if seedArg != nil {
		return rand.New(rand.NewSource(int64(*seedArg)))
	}

	if h.cfg != nil && h.cfg.SeededRNG.Enabled && h.cfg.SeededRNG.DeterministicDeckDraws {
		hasher := fnv.New64a()
		_, _ = hasher.Write([]byte(deckID))
		_, _ = hasher.Write([]byte("|"))
		_, _ = hasher.Write([]byte(packStackID))
		_, _ = hasher.Write([]byte("|"))
		_, _ = hasher.Write([]byte(fmt.Sprintf("%d", state.NextZ)))
		return rand.New(rand.NewSource(int64(hasher.Sum64())))
	}

	return rand.New(rand.NewSource(time.Now().UnixNano()))
}

func pickWeightedDeckEntry(pool []config.DeckRNGEntry, rng *rand.Rand) (config.DeckRNGEntry, error) {
	total := 0
	for _, e := range pool {
		if e.Weight > 0 {
			total += e.Weight
		}
	}
	if total <= 0 {
		return config.DeckRNGEntry{}, fmt.Errorf("deck rng_pool has no positive weights")
	}

	pick := rng.Intn(total)
	running := 0
	for _, e := range pool {
		if e.Weight <= 0 {
			continue
		}
		running += e.Weight
		if pick < running {
			return e, nil
		}
	}

	return config.DeckRNGEntry{}, fmt.Errorf("failed to draw deck entry")
}

func mapDeckEntryToCard(e config.DeckRNGEntry) (drawnCard, error) {
	switch e.CardType {
	case "blank":
		return drawnCard{defID: "task.blank", data: map[string]any{}}, nil
	case "villager":
		data := map[string]any{}
		if strings.TrimSpace(e.VillagerID) != "" {
			data["villager_id"] = e.VillagerID
		}
		return drawnCard{defID: "villager.basic", data: data}, nil
	case "modifier":
		if strings.TrimSpace(e.ModifierID) == "" {
			return drawnCard{}, fmt.Errorf("modifier entry missing modifier_id")
		}
		return drawnCard{defID: model.CardDefID("mod." + e.ModifierID), data: map[string]any{}}, nil
	case "loot":
		if strings.TrimSpace(e.LootID) == "" {
			return drawnCard{}, fmt.Errorf("loot entry missing loot_id")
		}
		data := map[string]any{}
		if e.Amount > 0 {
			data["amount"] = e.Amount
		}
		return drawnCard{defID: model.CardDefID("loot." + e.LootID), data: data}, nil
	case "resource":
		if strings.TrimSpace(e.ResourceID) == "" {
			return drawnCard{}, fmt.Errorf("resource entry missing resource_id")
		}
		return drawnCard{defID: model.CardDefID("resource." + e.ResourceID), data: map[string]any{}}, nil
	case "food":
		if strings.TrimSpace(e.FoodID) == "" {
			return drawnCard{}, fmt.Errorf("food entry missing food_id")
		}
		data := map[string]any{}
		if e.Amount > 0 {
			data["amount"] = e.Amount
		}
		return drawnCard{defID: model.CardDefID("food." + e.FoodID), data: data}, nil
	default:
		return drawnCard{}, fmt.Errorf("unsupported deck card_type: %s", e.CardType)
	}
}

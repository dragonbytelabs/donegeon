package game

import (
	"context"
	"errors"
	"fmt"
	"time"

	"donegeon/internal/building"
	"donegeon/internal/deck"
	"donegeon/internal/loot"
	"donegeon/internal/modifier"
	"donegeon/internal/quest"
	"donegeon/internal/recipe"
	"donegeon/internal/task"
	"donegeon/internal/telemetry"
	"donegeon/internal/villager"
	"donegeon/internal/world"
	"donegeon/internal/zombie"
)

type Engine struct {
	Tasks     task.Repository
	Quests    quest.Repository
	Recipes   recipe.Repository
	Modifiers modifier.Repository
	Villagers villager.Repository
	Zombies   zombie.Repository
	World     *world.MemoryRepo
	Loot      loot.Repository
	Decks     deck.Repository
	Buildings building.Repository
	Cards     CardRepository
	GameState GameStateRepository
	Clock     Clock
	Telemetry telemetry.Repository
}

type DayTickResult struct {
	Day              string `json:"day"`
	ZombiesSpawned   int    `json:"zombies_spawned"`
	ZombiesTotal     int    `json:"zombies_total"`
	VillagersBlocked int    `json:"villagers_blocked"`
	SlotsAvailable   int    `json:"slots_available"`
	LootPenaltyPct   int    `json:"loot_penalty_pct"`
	PackCostPct      int    `json:"pack_cost_pct"`
	Overrun          bool   `json:"overrun"`
}

type TodaySummary struct {
	Day              string `json:"day"`
	VillagersFree    int    `json:"villagers_free"`
	VillagersBlocked int    `json:"villagers_blocked"`
	VillagersTotal   int    `json:"villagers_total"`
	SlotsAvailable   int    `json:"slots_available"`
	TasksLive        int    `json:"tasks_live"`
	TasksCompleted   int    `json:"tasks_completed_today"`
	ZombiesActive    int    `json:"zombies_active"`
	DangerLevel      string `json:"danger_level"` // "safe", "warning", "danger", "overrun"
	LootPenaltyPct   int    `json:"loot_penalty_pct"`
	PackCostPct      int    `json:"pack_cost_pct"`
}

func (e Engine) DayTick(ctx context.Context) (DayTickResult, error) {
	w, err := e.World.Get(ctx)
	if err != nil {
		return DayTickResult{}, err
	}

	// Advance one day (date anchor)
	w.Day = w.Day.AddDate(0, 0, 1)

	// Evaluate at end-of-day of the NEW day
	now := endOfDay(w.Day)

	// Reset villagers for the new day (and persist)
	vs, err := e.Villagers.List(ctx)
	if err != nil {
		return DayTickResult{}, err
	}
	for i := range vs {
		vs[i].ResetDay()
	}
	if err := e.Villagers.UpdateMany(ctx, vs); err != nil {
		return DayTickResult{}, err
	}

	// Evaluate live tasks for zombie spawns
	liveTasks, err := e.Tasks.ListByZone(ctx, task.ZoneLive)
	if err != nil {
		return DayTickResult{}, err
	}

	zSpawned := 0
	const maxZombiesPerDay = 5 // Cap to prevent overwhelming the player

	for _, t := range liveTasks {
		if t.Completed {
			continue
		}

		// Stop spawning if we've hit the daily cap
		if zSpawned >= maxZombiesPerDay {
			break
		}

		mods, err := e.getTaskMods(ctx, t)
		if err != nil {
			return DayTickResult{}, err
		}

		// deadline missed
		if mods.Deadline != nil && mods.Deadline.DeadlineAt != nil && now.After(*mods.Deadline.DeadlineAt) {
			exists, _ := e.Zombies.ExistsForTask(ctx, t.ID, zombie.ReasonDeadlineMissed)
			if !exists && zSpawned < maxZombiesPerDay {
				_ = e.Zombies.Add(ctx, zombie.Zombie{
					ID:        fmt.Sprintf("z_%d_deadline_%d", t.ID, now.Unix()),
					TaskID:    t.ID,
					Reason:    zombie.ReasonDeadlineMissed,
					SpawnedAt: now,
				})
				zSpawned++
			}
		}

		// important ignored too long (only if seal exists)
		if mods.Important != nil && zSpawned < maxZombiesPerDay {
			ignoreDays := 2
			if mods.Important.MaxCharges > 0 && mods.Important.Charges > 0 {
				ignoreDays = 1
			}

			if t.LiveAt != nil {
				days := int(now.Sub(*t.LiveAt).Hours() / 24)
				if days >= ignoreDays {
					exists, _ := e.Zombies.ExistsForTask(ctx, t.ID, zombie.ReasonImportantIgnored)
					if !exists {
						_ = e.Zombies.Add(ctx, zombie.Zombie{
							ID:        fmt.Sprintf("z_%d_important_%d", t.ID, now.Unix()),
							TaskID:    t.ID,
							Reason:    zombie.ReasonImportantIgnored,
							SpawnedAt: now,
						})
						zSpawned++
					}
				}
			}
		}

		// recurring fires (advance NextAt even when empty to prevent spam)
		if mods.Recurring != nil &&
			mods.Recurring.RecurringEveryDays > 0 &&
			mods.Recurring.RecurringNextAt != nil &&
			!now.Before(*mods.Recurring.RecurringNextAt) {

			c := *mods.Recurring

			// Always advance NextAt when it fires
			nextAt := c.RecurringNextAt.AddDate(0, 0, c.RecurringEveryDays)
			c.RecurringNextAt = &nextAt

			// If empty => spawn zombie once
			if c.Spent() && zSpawned < maxZombiesPerDay {
				exists, _ := e.Zombies.ExistsForTask(ctx, t.ID, zombie.ReasonRecurringNoCharges)
				if !exists {
					_ = e.Zombies.Add(ctx, zombie.Zombie{
						ID:        fmt.Sprintf("z_%d_recur_%d", t.ID, now.Unix()),
						TaskID:    t.ID,
						Reason:    zombie.ReasonRecurringNoCharges,
						SpawnedAt: now,
					})
					zSpawned++
				}
			} else {
				_ = c.Spend(1)
			}

			_, _ = e.Modifiers.Update(ctx, c)
		}
	}

	// Process completed recurring tasks - spawn new instances
	completedTasks, err := e.Tasks.ListByZone(ctx, task.ZoneCompleted)
	if err != nil {
		return DayTickResult{}, err
	}

	for _, t := range completedTasks {
		if t.IsRecurring() && t.ShouldRecur(now) {
			// Create new instance of recurring task
			newTask := t.Recur()
			if _, err := e.Tasks.Create(ctx, newTask.Name, newTask.Description); err != nil {
				// Log but don't fail the entire day tick
				continue
			}

			// Archive the old completed task
			t.Archive()
			if _, err := e.Tasks.Update(ctx, t); err != nil {
				continue
			}
		}
	}

	// Capacity pressure: recalc blocking immediately based on zombie count
	zTotal, err := e.Zombies.Count(ctx)
	if err != nil {
		return DayTickResult{}, err
	}

	block, slots, err := e.recalcBlocking(ctx)
	if err != nil {
		return DayTickResult{}, err
	}

	// Global penalties
	lootPenalty := min(50, zTotal*10)
	packCost := min(100, zTotal*15)
	overrun := zTotal >= 5

	// Apply tired status to villagers if zombie count is high
	if zTotal >= 4 {
		// Get all villagers
		villagers, err := e.Villagers.List(ctx)
		if err == nil {
			// Make villagers tired for 1 day for every 2 zombies over 3
			daysToTire := (zTotal - 3) / 2
			if daysToTire < 1 {
				daysToTire = 1
			}
			tiredUntil := w.Day.AddDate(0, 0, daysToTire)

			for i := range villagers {
				villagers[i].MakeTired(tiredUntil)
			}
			_ = e.Villagers.UpdateMany(ctx, villagers)
		}
	}

	w.LootPenaltyPct = lootPenalty
	w.PackCostPct = packCost
	w.Overrun = overrun

	if err := e.World.Set(ctx, w); err != nil {
		return DayTickResult{}, err
	}

	// Record telemetry
	if e.Telemetry != nil {
		_ = e.Telemetry.RecordEvent(telemetry.EventDayTick, telemetry.EventMetadata{
			"day":               w.Day.Format("2006-01-02"),
			"zombies_spawned":   zSpawned,
			"zombies_total":     zTotal,
			"villagers_blocked": block,
			"loot_penalty_pct":  lootPenalty,
		})
	}

	return DayTickResult{
		Day:              w.Day.Format("2006-01-02"),
		ZombiesSpawned:   zSpawned,
		ZombiesTotal:     zTotal,
		VillagersBlocked: block,
		SlotsAvailable:   slots,
		LootPenaltyPct:   lootPenalty,
		PackCostPct:      packCost,
		Overrun:          overrun,
	}, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (e Engine) Progress(ctx context.Context) error {
	// TODO: Integrate new quest progress system
	// The new quest system tracks progress through Objectives and Progress arrays
	// instead of the old Progress(tasks) method
	return nil
}

// TrackTaskProcessed increments the tasks processed counter and checks for deck unlocks
func (e Engine) TrackTaskProcessed(ctx context.Context) error {
	w, err := e.World.Get(ctx)
	if err != nil {
		return err
	}

	w.TasksProcessed++

	// Check for Organization Deck unlock at 10 tasks
	if w.TasksProcessed == 10 {
		deck, ok, err := e.Decks.Get(ctx, "deck_organization")
		if err == nil && ok && deck.Status == "locked" {
			deck.Status = "unlocked"
			_ = e.Decks.Update(ctx, deck)
		}
	}

	return e.World.Set(ctx, w)
}

type CraftResult struct {
	RecipeID        string      `json:"recipe_id"`
	ConsumedTaskIDs []int       `json:"consumed_task_ids"`
	CreatedTasks    []task.Task `json:"created_tasks"`
}

func (e Engine) Craft(ctx context.Context, recipeID string) (CraftResult, error) {
	rec, ok, err := e.Recipes.Get(ctx, recipeID)
	if err != nil {
		return CraftResult{}, err
	}
	if !ok {
		return CraftResult{}, fmt.Errorf("recipe not found: %s", recipeID)
	}
	if rec.Status != recipe.StatusUnlocked {
		return CraftResult{}, errors.New("recipe is locked")
	}

	tasksNow, err := e.Tasks.ListByZone(ctx, task.ZoneLive)
	if err != nil {
		return CraftResult{}, err
	}

	consumeIDs := []int{}
	remaining := make([]task.Task, len(tasksNow))
	copy(remaining, tasksNow)

	shouldConsume := func(ing recipe.Ingredient) bool {
		// default "" => consume
		return ing.Mode != recipe.ModeRequire
	}
	needCount := func(n int) int {
		if n <= 0 {
			return 1
		}
		return n
	}

	// --- Select tasks for each ingredient (consume vs require-only) ---
	for _, ing := range rec.Ingredients {
		n := needCount(ing.Count)

		switch ing.Type {

		case recipe.IngTaskNamed:
			if shouldConsume(ing) {
				foundIDs := []int{}
				nextRemaining := make([]task.Task, 0, len(remaining))

				for _, t := range remaining {
					if n > 0 && t.Name == ing.Name {
						foundIDs = append(foundIDs, t.ID)
						n--
						continue // consumed
					}
					nextRemaining = append(nextRemaining, t)
				}
				remaining = nextRemaining

				if n > 0 {
					return CraftResult{}, fmt.Errorf("missing ingredient: need %d more task(s) named %q", n, ing.Name)
				}
				consumeIDs = append(consumeIDs, foundIDs...)
			} else {
				count := 0
				for _, t := range remaining {
					if t.Name == ing.Name {
						count++
					}
				}
				if count < n {
					return CraftResult{}, fmt.Errorf("missing requirement: need %d task(s) named %q", n, ing.Name)
				}
			}

		case recipe.IngTaskTagged:
			if shouldConsume(ing) {
				foundIDs := []int{}
				nextRemaining := make([]task.Task, 0, len(remaining))

				for _, t := range remaining {
					if n > 0 && t.HasTag(ing.Tag) {
						foundIDs = append(foundIDs, t.ID)
						n--
						continue
					}
					nextRemaining = append(nextRemaining, t)
				}
				remaining = nextRemaining

				if n > 0 {
					return CraftResult{}, fmt.Errorf("missing ingredient: need %d more task(s) tagged %q", n, ing.Tag)
				}
				consumeIDs = append(consumeIDs, foundIDs...)
			} else {
				count := 0
				for _, t := range remaining {
					if t.HasTag(ing.Tag) {
						count++
					}
				}
				if count < n {
					return CraftResult{}, fmt.Errorf("missing requirement: need %d task(s) tagged %q", n, ing.Tag)
				}
			}

		case recipe.IngTaskCompleted:
			if shouldConsume(ing) {
				foundIDs := []int{}
				nextRemaining := make([]task.Task, 0, len(remaining))

				for _, t := range remaining {
					if n > 0 && t.Completed {
						foundIDs = append(foundIDs, t.ID)
						n--
						continue
					}
					nextRemaining = append(nextRemaining, t)
				}
				remaining = nextRemaining

				if n > 0 {
					return CraftResult{}, fmt.Errorf("missing ingredient: need %d more completed task(s)", n)
				}
				consumeIDs = append(consumeIDs, foundIDs...)
			} else {
				count := 0
				for _, t := range remaining {
					if t.Completed {
						count++
					}
				}
				if count < n {
					return CraftResult{}, fmt.Errorf("missing requirement: need %d completed task(s)", n)
				}
			}

		case recipe.IngTaskCount:
			if shouldConsume(ing) {
				if len(remaining) < n {
					return CraftResult{}, fmt.Errorf("missing ingredient: need %d task(s) total", n)
				}
				for i := 0; i < n; i++ {
					consumeIDs = append(consumeIDs, remaining[i].ID)
				}
				remaining = remaining[n:]
			} else {
				if len(remaining) < n {
					return CraftResult{}, fmt.Errorf("missing requirement: need %d task(s) total", n)
				}
			}

		default:
			return CraftResult{}, fmt.Errorf("unknown ingredient type: %s", ing.Type)
		}
	}

	// --- Consume ---
	for _, id := range consumeIDs {
		_, err := e.Tasks.Delete(ctx, id)
		if err != nil {
			return CraftResult{}, err
		}
	}

	// --- Produce outputs ---
	created := []task.Task{}
	for _, out := range rec.Outputs {
		switch out.Type {

		case recipe.OutCreateTask:
			n := needCount(out.Count)
			for i := 0; i < n; i++ {
				tk, err := e.Tasks.Create(ctx, out.Name, out.Description)
				if err != nil {
					return CraftResult{}, err
				}
				created = append(created, tk)
			}

		default:
			return CraftResult{}, fmt.Errorf("unknown output type: %s", out.Type)
		}
	}

	// Progress after crafting (new tasks may complete quests)
	_ = e.Progress(ctx)

	return CraftResult{
		RecipeID:        recipeID,
		ConsumedTaskIDs: consumeIDs,
		CreatedTasks:    created,
	}, nil
}

type ClearZombieResult struct {
	ZombieID         string `json:"zombie_id"`
	UsedVillager     string `json:"used_villager"`
	StaminaSpent     int    `json:"stamina_spent"`
	ZombiesTotal     int    `json:"zombies_total"`
	VillagersBlocked int    `json:"villagers_blocked"`
	StaminaAvailable int    `json:"stamina_available"`
	StaminaRemaining int    `json:"stamina_remaining"`
}

func (e Engine) ClearZombie(ctx context.Context, zombieID string, slots int) (ClearZombieResult, error) {
	if slots <= 0 {
		slots = 1
	}
	if slots > 2 {
		return ClearZombieResult{}, errors.New("slots must be 1 or 2")
	}

	// Find an available villager (not blocked and has slots)
	vs, err := e.Villagers.List(ctx)
	if err != nil {
		return ClearZombieResult{}, err
	}

	vidx := -1
	for i := range vs {
		if vs[i].BlockedByZombie {
			continue
		}
		if vs[i].Stamina >= slots {
			vidx = i
			break
		}
	}
	if vidx == -1 {
		return ClearZombieResult{}, errors.New("no available villager with enough stamina")
	}

	// Spend stamina
	vs[vidx].Stamina -= slots

	// Remove zombie
	ok, err := e.Zombies.Remove(ctx, zombieID)
	if err != nil {
		return ClearZombieResult{}, err
	}
	if !ok {
		return ClearZombieResult{}, errors.New("zombie not found")
	}

	// Persist villagers
	if err := e.Villagers.UpdateMany(ctx, vs); err != nil {
		return ClearZombieResult{}, err
	}

	zTotal, err := e.Zombies.Count(ctx)
	if err != nil {
		return ClearZombieResult{}, err
	}

	blocked, slotsAvail, err := e.recalcBlocking(ctx)
	if err != nil {
		return ClearZombieResult{}, err
	}

	return ClearZombieResult{
		ZombieID:         zombieID,
		UsedVillager:     vs[vidx].ID,
		StaminaSpent:     slots,
		ZombiesTotal:     zTotal,
		VillagersBlocked: blocked,
		StaminaAvailable: slotsAvail,
		StaminaRemaining: vs[vidx].Stamina,
	}, nil
}

func (e Engine) recalcBlocking(ctx context.Context) (villagersBlocked int, slotsAvailable int, err error) {
	zTotal, err := e.Zombies.Count(ctx)
	if err != nil {
		return 0, 0, err
	}

	vs, err := e.Villagers.List(ctx)
	if err != nil {
		return 0, 0, err
	}

	// Determine how many must be blocked
	block := zTotal
	if block > len(vs) {
		block = len(vs)
	}

	// Unblock everyone first (do NOT reset stamina here)
	for i := range vs {
		vs[i].BlockedByZombie = false
		// Keep their current stamina
	}

	// Block the first `block` villagers (stable order from repo)
	for i := 0; i < block; i++ {
		vs[i].BlockedByZombie = true
		vs[i].Stamina = 0
	}

	// Compute available stamina
	slots := 0
	for _, v := range vs {
		slots += v.Stamina
	}

	if err := e.Villagers.UpdateMany(ctx, vs); err != nil {
		return 0, 0, err
	}

	return block, slots, nil
}

type AttachModifierResult struct {
	Task     task.Task     `json:"task"`
	Modifier modifier.Card `json:"modifier"`
}

func (e Engine) AttachModifier(ctx context.Context, taskID int, card modifier.Card) (AttachModifierResult, error) {
	// fetch task
	t, ok, err := e.Tasks.Get(ctx, taskID)
	if err != nil {
		return AttachModifierResult{}, err
	}
	if !ok {
		return AttachModifierResult{}, fmt.Errorf("task not found: %d", taskID)
	}

	// create modifier card
	created, err := e.Modifiers.Create(ctx, card)
	if err != nil {
		return AttachModifierResult{}, err
	}

	// Set task_id to track which task this modifier is attached to
	created.TaskID = &taskID
	created, err = e.Modifiers.Update(ctx, created)
	if err != nil {
		return AttachModifierResult{}, err
	}

	// attach
	t.AddModifier(created.ID)
	updated, err := e.Tasks.Update(ctx, t)
	if err != nil {
		return AttachModifierResult{}, err
	}

	// Progress because attachments change zombie eligibility/recurrence behavior
	_ = e.Progress(ctx)

	return AttachModifierResult{Task: updated, Modifier: created}, nil
}

func (e Engine) DetachModifier(ctx context.Context, taskID int, modifierID string) (task.Task, error) {
	t, ok, err := e.Tasks.Get(ctx, taskID)
	if err != nil {
		return task.Task{}, err
	}
	if !ok {
		return task.Task{}, fmt.Errorf("task not found: %d", taskID)
	}

	t.RemoveModifier(modifierID)
	updated, err := e.Tasks.Update(ctx, t)
	if err != nil {
		return task.Task{}, err
	}

	_ = e.Progress(ctx)
	return updated, nil
}

type taskMods struct {
	Deadline  *modifier.Card
	Important *modifier.Card
	Recurring *modifier.Card
}

func (e Engine) getTaskMods(ctx context.Context, t task.Task) (taskMods, error) {
	var out taskMods
	for _, mid := range t.ModifierIDs {
		c, ok, err := e.Modifiers.Get(ctx, mid)
		if err != nil {
			return out, err
		}
		if !ok {
			continue
		}
		switch c.Type {
		case modifier.DeadlinePin:
			// first wins
			if out.Deadline == nil {
				out.Deadline = &c
			}
		case modifier.ImportanceSeal:
			if out.Important == nil {
				out.Important = &c
			}
		case modifier.RecurringContract:
			if out.Recurring == nil {
				out.Recurring = &c
			}
		}
	}
	return out, nil
}

func (e Engine) now() time.Time {
	if e.Clock == nil {
		return time.Now()
	}
	return e.Clock.Now()
}

func endOfDay(t time.Time) time.Time {
	// Keep location
	y, m, d := t.Date()
	loc := t.Location()
	return time.Date(y, m, d, 23, 59, 0, 0, loc)
}

type CompleteTaskResult struct {
	Task      task.Task   `json:"task"`
	LootDrops []loot.Drop `json:"loot_drops"`
}

// CompleteTask marks a task complete and generates loot drops
func (e Engine) CompleteTask(ctx context.Context, taskID int) (CompleteTaskResult, error) {
	t, ok, err := e.Tasks.Get(ctx, taskID)
	if err != nil {
		return CompleteTaskResult{}, err
	}
	if !ok {
		return CompleteTaskResult{}, fmt.Errorf("task not found: %d", taskID)
	}

	// Mark complete
	t.MarkComplete()
	_, err = e.Tasks.Update(ctx, t)
	if err != nil {
		return CompleteTaskResult{}, err
	}

	// Grant XP to assigned villager
	if t.AssignedVillager != "" {
		v, found, err := e.Villagers.Get(ctx, t.AssignedVillager)
		if err == nil && found {
			leveledUp := v.CompleteTask()
			if _, err := e.Villagers.Update(ctx, v); err == nil && leveledUp {
				// Could add level up notification here
			}
		}
	}

	// Generate loot drops based on task type
	var drops []loot.Drop
	if t.Zone == task.ZoneLive {
		// Get loot table based on inferred task type
		var table loot.Table
		switch t.InferType() {
		case task.TaskTypeAdmin:
			table = loot.AdminTable
		case task.TaskTypeMaintenance:
			table = loot.MaintenanceTable
		case task.TaskTypePlanning:
			table = loot.PlanningTable
		case task.TaskTypeDeepWork:
			table = loot.DeepWorkTable
		case task.TaskTypePerpetualFlow:
			table = loot.PerpetualFlowTable
		case task.TaskTypeCleanup:
			table = loot.CleanupTable
		default:
			table = loot.AdminTable
		}

		drops = table.Roll()

		// Apply zombie penalty
		w, err := e.World.Get(ctx)
		if err == nil && w.LootPenaltyPct > 0 {
			drops = loot.ApplyPenalty(drops, w.LootPenaltyPct)
		}

		// Salvage spent modifiers attached to this task
		if e.Modifiers != nil {
			allMods, err := e.Modifiers.List(ctx)
			if err == nil {
				for _, mod := range allMods {
					// Check if this modifier was used on this task and is now spent
					if mod.TaskID != nil && *mod.TaskID == t.ID && mod.Spent() {
						// Salvage rules: convert spent modifier to loot
						salvageLoot := salvageModifier(mod)
						if len(salvageLoot) > 0 {
							drops = append(drops, salvageLoot...)
						}

						// Update modifier status
						mod.Status = modifier.StatusSpent
						_, _ = e.Modifiers.Update(ctx, mod)
					}
				}
			}
		}

		// Add loot to inventory
		if len(drops) > 0 {
			inv, err := e.Loot.Get(ctx)
			if err == nil {
				inv.Add(drops)
				_ = e.Loot.Update(ctx, inv)
			}
		}
	}

	// Progress quests
	_ = e.Progress(ctx)

	// Record telemetry
	if e.Telemetry != nil {
		_ = e.Telemetry.RecordEvent(telemetry.EventTaskCompleted, telemetry.EventMetadata{
			"task_id":    taskID,
			"task_name":  t.Name,
			"task_type":  string(t.InferType()),
			"loot_count": len(drops),
		})
	}

	return CompleteTaskResult{
		Task:      t,
		LootDrops: drops,
	}, nil
}

// salvageModifier converts a spent modifier into loot
func salvageModifier(mod modifier.Card) []loot.Drop {
	// Salvage rules by modifier type
	switch mod.Type {
	case modifier.RecurringContract:
		// Recurring contracts salvage into paper
		return []loot.Drop{{Type: loot.Paper, Amount: 1}}
	case modifier.DeadlinePin:
		// Deadline pins don't salvage (permanent)
		return nil
	case modifier.ScheduleToken:
		// Schedule tokens salvage into ink
		return []loot.Drop{{Type: loot.Ink, Amount: 1}}
	case modifier.ImportanceSeal:
		// Importance seals salvage into paper
		return []loot.Drop{{Type: loot.Paper, Amount: 1}}
	default:
		// Default: salvage into 1 coin
		return []loot.Drop{{Type: loot.Coin, Amount: 1}}
	}
}

// OpenDeck opens a deck/pack and returns the drops
func (e Engine) OpenDeck(ctx context.Context, deckID string) (deck.OpenResult, error) {
	// Get deck
	d, ok, err := e.Decks.Get(ctx, deckID)
	if err != nil {
		return deck.OpenResult{}, err
	}
	if !ok {
		return deck.OpenResult{}, fmt.Errorf("deck not found: %s", deckID)
	}

	// Check if unlocked
	if d.Status != deck.StatusUnlocked {
		return deck.OpenResult{}, errors.New("deck is locked")
	}

	// Get world state for pack cost penalty
	w, err := e.World.Get(ctx)
	if err != nil {
		return deck.OpenResult{}, err
	}

	// Calculate cost
	cost := d.GetCost(w.PackCostPct)

	// Check and spend coins
	inv, err := e.Loot.Get(ctx)
	if err != nil {
		return deck.OpenResult{}, err
	}

	if !inv.Has(loot.Coin, cost) {
		return deck.OpenResult{}, fmt.Errorf("insufficient coins: need %d, have %d", cost, inv.Coin)
	}

	if !inv.Spend(loot.Coin, cost) {
		return deck.OpenResult{}, errors.New("failed to spend coins")
	}

	// Update inventory
	if err := e.Loot.Update(ctx, inv); err != nil {
		return deck.OpenResult{}, err
	}

	// Get deck definition and open it
	def, ok := deck.Definitions[d.Type]
	if !ok {
		return deck.OpenResult{}, fmt.Errorf("unknown deck type: %s", d.Type)
	}

	drops := def.Open()

	// Process drops into inventory/state
	for _, drop := range drops {
		switch drop.Type {
		case "loot":
			// Loot cards are spawned on the board for manual collection
			// Do not auto-add to inventory - player must drag to Collect deck
		case "modifier":
			// Create modifier card in game state
			if drop.ModifierCard != nil && e.Cards != nil {
				card := &Card{
					ID:         fmt.Sprintf("modifier-%d-%d", time.Now().UnixNano(), len(drops)),
					Type:       CardTypeModifier,
					Zone:       CardZoneBoard,
					ModifierID: &drop.ModifierCard.ID,
					Charges:    &drop.ModifierCard.Charges,
				}
				_ = e.Cards.Create(ctx, card)
			}
		case "blank_task":
			// Blank task cards are spawned on board
		case "villager":
			// Would create a new villager (future)
		}
	}

	// Save updated inventory
	if err := e.Loot.Update(ctx, inv); err != nil {
		return deck.OpenResult{}, err
	}

	// Increment times opened
	d.TimesOpened++
	if err := e.Decks.Update(ctx, d); err != nil {
		return deck.OpenResult{}, err
	}

	// Record telemetry
	if e.Telemetry != nil {
		_ = e.Telemetry.RecordEvent(telemetry.EventDeckOpened, telemetry.EventMetadata{
			"deck_id":      deckID,
			"deck_type":    string(d.Type),
			"cost_paid":    cost,
			"times_opened": d.TimesOpened,
			"drops_count":  len(drops),
		})
	}

	return deck.OpenResult{
		DeckID:   deckID,
		Drops:    drops,
		CostPaid: cost,
	}, nil
}

// ConstructBuilding builds a building if materials are available
func (e Engine) ConstructBuilding(ctx context.Context, buildingType building.Type) (building.Building, error) {
	// Get building
	b, ok, err := e.Buildings.GetByType(ctx, buildingType)
	if err != nil {
		return building.Building{}, err
	}
	if !ok {
		return building.Building{}, fmt.Errorf("building not found: %s", buildingType)
	}

	// Check if already built
	if b.Status == building.StatusBuilt {
		return building.Building{}, errors.New("building already constructed")
	}

	// Get recipe
	recipe, ok := building.Recipes[buildingType]
	if !ok {
		return building.Building{}, fmt.Errorf("no recipe for building: %s", buildingType)
	}

	// Get inventory
	inv, err := e.Loot.Get(ctx)
	if err != nil {
		return building.Building{}, err
	}

	// Check if can build
	if !recipe.CanBuild(inv) {
		return building.Building{}, errors.New("insufficient materials")
	}

	// Spend materials
	if !recipe.SpendCost(&inv) {
		return building.Building{}, errors.New("failed to spend materials")
	}

	// Update inventory
	if err := e.Loot.Update(ctx, inv); err != nil {
		return building.Building{}, err
	}

	// Mark building as built
	if err := e.Buildings.Build(ctx, buildingType); err != nil {
		return building.Building{}, err
	}

	// Get updated building
	b, ok, err = e.Buildings.GetByType(ctx, buildingType)
	if err != nil {
		return building.Building{}, err
	}

	// Apply building effects
	switch buildingType {
	case building.TypeRestHall:
		// Give all villagers +1 max stamina
		vs, err := e.Villagers.List(ctx)
		if err == nil {
			for i := range vs {
				vs[i].MaxStamina++
				vs[i].Stamina++ // Also restore 1 stamina immediately
			}
			_ = e.Villagers.UpdateMany(ctx, vs)
		}
	}

	return b, nil
}

func (e Engine) TodaySummary(ctx context.Context) (TodaySummary, error) {
	w, err := e.World.Get(ctx)
	if err != nil {
		return TodaySummary{}, err
	}

	// Count villagers
	villagers, err := e.Villagers.List(ctx)
	if err != nil {
		return TodaySummary{}, err
	}

	villagersFree := 0
	villagersBlocked := 0
	for _, v := range villagers {
		if v.IsAvailable() {
			villagersFree++
		} else {
			villagersBlocked++
		}
	}

	// Count tasks
	liveTasks, err := e.Tasks.ListByZone(ctx, task.ZoneLive)
	if err != nil {
		return TodaySummary{}, err
	}

	completedTasks, err := e.Tasks.CountCompletedToday(ctx)
	if err != nil {
		completedTasks = 0 // Don't fail on this
	}

	// Count zombies
	zombieCount, err := e.Zombies.Count(ctx)
	if err != nil {
		return TodaySummary{}, err
	}

	// Calculate danger level
	dangerLevel := "safe"
	if zombieCount >= 5 {
		dangerLevel = "overrun"
	} else if zombieCount >= 3 {
		dangerLevel = "danger"
	} else if zombieCount > 0 {
		dangerLevel = "warning"
	}

	// Calculate slots (simplified: 1 slot per villager, reduced by zombies)
	baseSlots := len(villagers)
	zombiePenalty := zombieCount / 2
	slotsAvailable := baseSlots - zombiePenalty
	if slotsAvailable < 0 {
		slotsAvailable = 0
	}

	return TodaySummary{
		Day:              w.Day.Format("2006-01-02"),
		VillagersFree:    villagersFree,
		VillagersBlocked: villagersBlocked,
		VillagersTotal:   len(villagers),
		SlotsAvailable:   slotsAvailable,
		TasksLive:        len(liveTasks),
		TasksCompleted:   completedTasks,
		ZombiesActive:    zombieCount,
		DangerLevel:      dangerLevel,
		LootPenaltyPct:   w.LootPenaltyPct,
		PackCostPct:      w.PackCostPct,
	}, nil
}

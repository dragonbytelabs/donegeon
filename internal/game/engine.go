package game

import (
	"context"
	"errors"
	"fmt"
	"time"

	"donegeon/internal/modifier"
	"donegeon/internal/quest"
	"donegeon/internal/recipe"
	"donegeon/internal/task"
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
	Clock     Clock
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

	for _, t := range liveTasks {
		if t.Completed {
			continue
		}

		mods, err := e.getTaskMods(ctx, t)
		if err != nil {
			return DayTickResult{}, err
		}

		// deadline missed
		if mods.Deadline != nil && mods.Deadline.DeadlineAt != nil && now.After(*mods.Deadline.DeadlineAt) {
			exists, _ := e.Zombies.ExistsForTask(ctx, t.ID, zombie.ReasonDeadlineMissed)
			if !exists {
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
		if mods.Important != nil {
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
			if c.Spent() {
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

	w.LootPenaltyPct = lootPenalty
	w.PackCostPct = packCost
	w.Overrun = overrun

	if err := e.World.Set(ctx, w); err != nil {
		return DayTickResult{}, err
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
	tasksNow, err := e.Tasks.ListByZone(ctx, task.ZoneLive)
	if err != nil {
		return err
	}

	qs, err := e.Quests.Progress(ctx, tasksNow)
	if err != nil {
		return err
	}

	for _, q := range qs {
		if q.Status != quest.StatusComplete {
			continue
		}
		for _, rid := range q.Reward.UnlockRecipeIDs {
			_, _, _ = e.Recipes.Unlock(ctx, rid) // ignore missing for now
		}
	}
	return nil
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
	SlotsSpent       int    `json:"slots_spent"`
	ZombiesTotal     int    `json:"zombies_total"`
	VillagersBlocked int    `json:"villagers_blocked"`
	SlotsAvailable   int    `json:"slots_available"`
	SlotsRemaining   int    `json:"slots_remaining"`
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
		if vs[i].SlotsRemaining >= slots {
			vidx = i
			break
		}
	}
	if vidx == -1 {
		return ClearZombieResult{}, errors.New("no available villager with enough slots")
	}

	// Spend slots
	vs[vidx].SlotsRemaining -= slots

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
		SlotsSpent:       slots,
		ZombiesTotal:     zTotal,
		VillagersBlocked: blocked,
		SlotsAvailable:   slotsAvail,
		SlotsRemaining:   vs[vidx].SlotsRemaining,
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
		// Don't modify SlotsRemaining for unblocked villagers (they keep current remaining slots).
	}

	// Block the first `block` villagers (stable order from repo)
	for i := 0; i < block; i++ {
		vs[i].BlockedByZombie = true
		vs[i].SlotsRemaining = 0
	}

	// Compute available slots
	slots := 0
	for _, v := range vs {
		slots += v.SlotsRemaining
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

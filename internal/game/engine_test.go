package game

import (
	"context"
	"testing"
	"time"

	"donegeon/internal/modifier"
	"donegeon/internal/quest"
	"donegeon/internal/recipe"
	"donegeon/internal/task"
	"donegeon/internal/villager"
	"donegeon/internal/world"
	"donegeon/internal/zombie"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newEngineForTest(loc *time.Location) (Engine,
	*task.MemoryRepo,
	*modifier.MemoryRepo,
	*villager.MemoryRepo,
	*zombie.MemoryRepo,
	*world.MemoryRepo,
) {
	taskRepo := task.NewMemoryRepo()
	questRepo := quest.NewMemoryRepo()
	recipeRepo := recipe.NewMemoryRepo()
	modRepo := modifier.NewMemoryRepo()
	villagerRepo := villager.NewMemoryRepo()
	zombieRepo := zombie.NewMemoryRepo()
	worldRepo := world.NewMemoryRepo()

	// Deterministic clock in SAME location as the test's world day.
	fake := NewFakeClock(time.Date(2026, 1, 1, 9, 0, 0, 0, loc))

	e := Engine{
		Tasks:     taskRepo,
		Quests:    questRepo,
		Recipes:   recipeRepo,
		Modifiers: modRepo,
		Villagers: villagerRepo,
		Zombies:   zombieRepo,
		World:     worldRepo,
		Clock:     fake,
	}
	return e, taskRepo, modRepo, villagerRepo, zombieRepo, worldRepo
}

func seedWorldAndVillagers(t *testing.T, ctx context.Context, villRepo *villager.MemoryRepo, worldRepo *world.MemoryRepo, startDay time.Time) {
	require.NoError(t, villRepo.Seed(ctx, []villager.Villager{
		{ID: "v1", Name: "Villager 1", StaminaPerDay: 3, SlotsRemaining: 3},
		{ID: "v2", Name: "Villager 2", StaminaPerDay: 3, SlotsRemaining: 3},
	}))
	require.NoError(t, worldRepo.Set(ctx, world.World{Day: startDay}))
}

func TestDayTick_DeadlinePin_SpawnsZombieAndBlocksVillager(t *testing.T) {
	ctx := context.Background()
	loc := time.FixedZone("ET", -5*60*60)

	e, taskRepo, _, villRepo, zombieRepo, worldRepo := newEngineForTest(loc)
	seedWorldAndVillagers(t, ctx, villRepo, worldRepo, time.Date(2026, 1, 1, 0, 0, 0, 0, loc))

	// Create task and make it LIVE
	tk, err := taskRepo.Create(ctx, "pay bill", "test deadline zombie")
	require.NoError(t, err)

	tk, ok, err := taskRepo.Process(ctx, tk.ID)
	require.NoError(t, err)
	require.True(t, ok)

	// Deadline before end-of-day of 2026-01-02 (after tick advances day)
	deadline := time.Date(2026, 1, 1, 12, 0, 0, 0, loc)
	_, err = e.AttachModifier(ctx, tk.ID, modifier.Card{
		ID:         "m_deadline_1",
		Type:       modifier.DeadlinePin,
		CreatedAt:  time.Date(2026, 1, 1, 9, 0, 0, 0, loc),
		MaxCharges: 0,
		Charges:    0,
		Status:     modifier.StatusActive,
		DeadlineAt: &deadline,
	})
	require.NoError(t, err)

	res, err := e.DayTick(ctx)
	require.NoError(t, err)

	assert.Equal(t, "2026-01-02", res.Day)
	assert.Equal(t, 1, res.ZombiesSpawned)
	assert.Equal(t, 1, res.ZombiesTotal)
	assert.Equal(t, 1, res.VillagersBlocked)
	assert.Equal(t, 3, res.SlotsAvailable)

	zs, err := zombieRepo.List(ctx)
	require.NoError(t, err)
	require.Len(t, zs, 1)
	assert.Equal(t, tk.ID, zs[0].TaskID)
	assert.Equal(t, "deadline_missed", zs[0].Reason)

	vs, err := villRepo.List(ctx)
	require.NoError(t, err)
	require.Len(t, vs, 2)
	assert.True(t, vs[0].BlockedByZombie)
	assert.Equal(t, 0, vs[0].SlotsRemaining)
}

func TestDayTick_RecurringContract_ConsumesCharge_AdvancesNextAt_NoZombie(t *testing.T) {
	ctx := context.Background()
	loc := time.FixedZone("ET", -5*60*60)

	e, taskRepo, modRepo, villRepo, zombieRepo, worldRepo := newEngineForTest(loc)
	seedWorldAndVillagers(t, ctx, villRepo, worldRepo, time.Date(2026, 1, 1, 0, 0, 0, 0, loc))

	tk, err := taskRepo.Create(ctx, "daily standup", "recurring test")
	require.NoError(t, err)
	_, ok, err := taskRepo.Process(ctx, tk.ID)
	require.NoError(t, err)
	require.True(t, ok)

	nextAt := time.Date(2026, 1, 2, 0, 0, 0, 0, loc)
	_, err = e.AttachModifier(ctx, tk.ID, modifier.Card{
		ID:                 "m_recur_1",
		Type:               modifier.RecurringContract,
		CreatedAt:          time.Date(2026, 1, 1, 9, 0, 0, 0, loc),
		MaxCharges:         4,
		Charges:            2,
		Status:             modifier.StatusActive,
		RecurringEveryDays: 1,
		RecurringNextAt:    &nextAt,
	})
	require.NoError(t, err)

	res, err := e.DayTick(ctx)
	require.NoError(t, err)
	assert.Equal(t, "2026-01-02", res.Day)
	assert.Equal(t, 0, res.ZombiesSpawned)

	m, ok, err := modRepo.Get(ctx, "m_recur_1")
	require.NoError(t, err)
	require.True(t, ok)
	assert.Equal(t, 1, m.Charges)
	assert.Equal(t, modifier.StatusActive, m.Status)
	require.NotNil(t, m.RecurringNextAt)
	assert.Equal(t, time.Date(2026, 1, 3, 0, 0, 0, 0, loc), *m.RecurringNextAt)

	zs, err := zombieRepo.List(ctx)
	require.NoError(t, err)
	require.Len(t, zs, 0)
}

func TestDayTick_RecurringContract_ZeroCharges_SpawnsZombie_AdvancesNextAt_NoSpam(t *testing.T) {
	ctx := context.Background()
	loc := time.FixedZone("ET", -5*60*60)

	e, taskRepo, modRepo, villRepo, zombieRepo, worldRepo := newEngineForTest(loc)
	seedWorldAndVillagers(t, ctx, villRepo, worldRepo, time.Date(2026, 1, 1, 0, 0, 0, 0, loc))

	tk, err := taskRepo.Create(ctx, "weekly cleanup", "recurring empty")
	require.NoError(t, err)
	_, ok, err := taskRepo.Process(ctx, tk.ID)
	require.NoError(t, err)
	require.True(t, ok)

	nextAt := time.Date(2026, 1, 2, 0, 0, 0, 0, loc)
	_, err = e.AttachModifier(ctx, tk.ID, modifier.Card{
		ID:                 "m_recur_0",
		Type:               modifier.RecurringContract,
		CreatedAt:          time.Date(2026, 1, 1, 9, 0, 0, 0, loc),
		MaxCharges:         4,
		Charges:            0,
		Status:             modifier.StatusSpent,
		RecurringEveryDays: 1,
		RecurringNextAt:    &nextAt,
	})
	require.NoError(t, err)

	// 1st tick spawns zombie
	_, err = e.DayTick(ctx)
	require.NoError(t, err)

	zs, err := zombieRepo.List(ctx)
	require.NoError(t, err)
	require.Len(t, zs, 1)
	assert.Equal(t, "recurring_no_charges", zs[0].Reason)

	// NextAt must advance even when empty (no spam)
	m, ok, err := modRepo.Get(ctx, "m_recur_0")
	require.NoError(t, err)
	require.True(t, ok)
	require.NotNil(t, m.RecurringNextAt)
	assert.Equal(t, time.Date(2026, 1, 3, 0, 0, 0, 0, loc), *m.RecurringNextAt)

	// 2nd + 3rd ticks should not create additional recurring_no_charges zombies for same task
	_, err = e.DayTick(ctx)
	require.NoError(t, err)
	_, err = e.DayTick(ctx)
	require.NoError(t, err)

	zs, err = zombieRepo.List(ctx)
	require.NoError(t, err)

	found := 0
	for _, z := range zs {
		if z.TaskID == tk.ID && z.Reason == "recurring_no_charges" {
			found++
		}
	}
	assert.Equal(t, 1, found)
}

func TestRecurringContract_HitsZero_BecomesSpent_ButRemainsAttached(t *testing.T) {
	ctx := context.Background()
	loc := time.FixedZone("ET", -5*60*60)

	e, taskRepo, modRepo, villRepo, _, worldRepo := newEngineForTest(loc)
	seedWorldAndVillagers(t, ctx, villRepo, worldRepo, time.Date(2026, 1, 1, 0, 0, 0, 0, loc))

	tk, err := taskRepo.Create(ctx, "daily journal", "spent lifecycle")
	require.NoError(t, err)
	tk, ok, err := taskRepo.Process(ctx, tk.ID)
	require.NoError(t, err)
	require.True(t, ok)

	nextAt := time.Date(2026, 1, 2, 0, 0, 0, 0, loc)
	_, err = e.AttachModifier(ctx, tk.ID, modifier.Card{
		ID:                 "m_recur_spent",
		Type:               modifier.RecurringContract,
		CreatedAt:          time.Date(2026, 1, 1, 9, 0, 0, 0, loc),
		MaxCharges:         4,
		Charges:            1,
		Status:             modifier.StatusActive,
		RecurringEveryDays: 1,
		RecurringNextAt:    &nextAt,
	})
	require.NoError(t, err)

	_, err = e.DayTick(ctx) // spends last charge
	require.NoError(t, err)

	m, ok, err := modRepo.Get(ctx, "m_recur_spent")
	require.NoError(t, err)
	require.True(t, ok)
	assert.Equal(t, 0, m.Charges)
	assert.Equal(t, modifier.StatusSpent, m.Status)

	tk2, ok, err := taskRepo.Get(ctx, tk.ID)
	require.NoError(t, err)
	require.True(t, ok)
	assert.Contains(t, tk2.ModifierIDs, "m_recur_spent")
}

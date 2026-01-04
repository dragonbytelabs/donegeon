package main

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"donegeon/internal/game"
	"donegeon/internal/modifier"
	"donegeon/internal/quest"
	"donegeon/internal/recipe"
	"donegeon/internal/server"
	"donegeon/internal/task"
	"donegeon/internal/villager"
	"donegeon/internal/world"
	"donegeon/internal/zombie"
)

const PORT = "42069"

func main() {
	ctx := context.Background()

	mux := http.NewServeMux()

	rr := &server.RouteRegistry{}
	server.RegisterAdminUI(mux, rr, PORT)
	server.RegisterStatic(mux)

	app, err := SeedGame(ctx)
	if err != nil {
		log.Fatal(err)
	}

	server.RegisterAPIRoutes(mux, rr, app)

	addr := ":" + PORT
	fmt.Printf("donegeon listening on %s\n", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

func SeedGame(ctx context.Context) (*server.App, error) {
	taskRepo := task.NewMemoryRepo()
	questRepo := quest.NewMemoryRepo()
	recipeRepo := recipe.NewMemoryRepo()
	villagerRepo := villager.NewMemoryRepo()
	zombieRepo := zombie.NewMemoryRepo()
	worldRepo := world.NewMemoryRepo()
	modifierRepo := modifier.NewMemoryRepo()

	clock := game.RealClock{}

	engine := game.Engine{
		Tasks:     taskRepo,
		Quests:    questRepo,
		Recipes:   recipeRepo,
		Modifiers: modifierRepo,
		Villagers: villagerRepo,
		Zombies:   zombieRepo,
		World:     worldRepo,
		Clock:     clock,
	}

	bootNow := engine.Clock.Now()

	// Seed villagers
	if err := villagerRepo.Seed(ctx, []villager.Villager{
		{ID: "v1", Name: "Villager 1", StaminaPerDay: 3, SlotsRemaining: 3},
		{ID: "v2", Name: "Villager 2", StaminaPerDay: 3, SlotsRemaining: 3},
	}); err != nil {
		return nil, err
	}

	// Seed recipes (light)
	_ = recipeRepo.Seed(ctx, []recipe.Recipe{
		{ID: "r_make_omelet", Title: "Make Omelet", Description: "Turn eggs into an omelet."},
		{ID: "r_buy_clippers", Title: "Buy Nail Clippers", Description: "Unlock the ability to clip nails (very BTCT)."},
	})

	// Seed quests
	_ = questRepo.Seed(ctx, []quest.Quest{
		{
			ID:           "q_intro",
			Title:        "First Steps",
			Description:  "Create your first task.",
			Status:       quest.StatusActive,
			Requirements: []quest.Requirement{{Type: quest.ReqTaskCount, Count: 1}},
			Reward: quest.Reward{
				UnlockQuestIDs:  []string{"q_eggs"},
				UnlockRecipeIDs: []string{"r_make_omelet"},
			},
		},
		{
			ID:           "q_eggs",
			Title:        "Egg Run",
			Description:  "Have a task named 'pick up eggs'.",
			Status:       quest.StatusLocked,
			Requirements: []quest.Requirement{{Type: quest.ReqTaskNamed, Name: "pick up eggs"}},
			Reward: quest.Reward{
				UnlockRecipeIDs: []string{"r_buy_clippers"},
			},
		},
	})

	// Seed “real” recipes
	_ = recipeRepo.Seed(ctx, []recipe.Recipe{
		{
			ID:          "r_make_omelet",
			Title:       "Make Omelet",
			Description: "Combine eggs into an omelet task.",
			Ingredients: []recipe.Ingredient{
				{Type: recipe.IngTaskNamed, Name: "pick up eggs", Count: 1, Mode: recipe.ModeConsume},
			},
			Outputs: []recipe.Output{
				{Type: recipe.OutCreateTask, Name: "cook omelet", Description: "stove time", Count: 1},
			},
		},
		{
			ID:          "r_buy_clippers",
			Title:       "Buy Nail Clippers",
			Description: "Unlock the ability to clip nails (very BTCT).",
		},
		{
			ID:          "r_cook_omelet",
			Title:       "Cook Omelet",
			Description: "Requires a stove, consumes eggs.",
			Ingredients: []recipe.Ingredient{
				{Type: recipe.IngTaskNamed, Name: "stove", Count: 1, Mode: recipe.ModeRequire},
				{Type: recipe.IngTaskNamed, Name: "pick up eggs", Count: 1, Mode: recipe.ModeConsume},
			},
			Outputs: []recipe.Output{
				{Type: recipe.OutCreateTask, Name: "eat omelet", Description: "delicious", Count: 1},
			},
		},
	})

	// Starter task
	_, _ = taskRepo.Create(ctx, "pick up eggs", "from the store")

	// Seed a guaranteed zombie scenario
	t, _ := taskRepo.Create(ctx, "pay bill", "test zombie")
	t, _, _ = taskRepo.Process(ctx, t.ID)

	dl := bootNow.AddDate(0, 0, -1)
	t.DeadlineAt = &dl
	_, _ = taskRepo.Update(ctx, t)

	_, _ = engine.AttachModifier(ctx, t.ID, modifier.Card{
		ID:         fmt.Sprintf("m_seed_deadline_%d", t.ID),
		Type:       modifier.DeadlinePin,
		CreatedAt:  bootNow,
		MaxCharges: 0,
		Charges:    0,
		Status:     modifier.StatusActive,
		DeadlineAt: &dl,
	})

	_, _ = engine.AttachModifier(ctx, t.ID, modifier.Card{
		ID:         fmt.Sprintf("m_seed_importance_%d", t.ID),
		Type:       modifier.ImportanceSeal,
		CreatedAt:  bootNow,
		MaxCharges: 3,
		Charges:    3,
		Status:     modifier.StatusActive,
	})

	_ = engine.Progress(ctx)

	return &server.App{
		Engine:       engine,
		TaskRepo:     taskRepo,
		QuestRepo:    questRepo,
		RecipeRepo:   recipeRepo,
		VillagerRepo: villagerRepo,
		ZombieRepo:   zombieRepo,
		WorldRepo:    worldRepo,
		ModifierRepo: modifierRepo,
		BootNow:      bootNow,
	}, nil
}

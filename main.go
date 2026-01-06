package main

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"donegeon/internal/building"
	"donegeon/internal/deck"
	"donegeon/internal/game"
	"donegeon/internal/loot"
	"donegeon/internal/modifier"
	"donegeon/internal/project"
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
	lootRepo := loot.NewMemoryRepo()
	deckRepo := deck.NewMemoryRepo()
	buildingRepo := building.NewMemoryRepo()
	projectRepo := project.NewMemoryRepo()
	cardRepo := game.NewMemoryCardRepo()
	gameStateRepo := game.NewMemoryGameStateRepo()

	clock := game.RealClock{}

	engine := game.Engine{
		Tasks:     taskRepo,
		Quests:    questRepo,
		Recipes:   recipeRepo,
		Modifiers: modifierRepo,
		Villagers: villagerRepo,
		Zombies:   zombieRepo,
		World:     worldRepo,
		Loot:      lootRepo,
		Decks:     deckRepo,
		Buildings: buildingRepo,
		Cards:     cardRepo,
		GameState: gameStateRepo,
		Clock:     clock,
	}

	bootNow := engine.Clock.Now()

	// Seed villagers
	if err := villagerRepo.Seed(ctx, []villager.Villager{
		{ID: "v1", Name: "Villager 1", MaxStamina: 10, Stamina: 10},
		{ID: "v2", Name: "Villager 2", MaxStamina: 10, Stamina: 10},
		{ID: "v3", Name: "Villager 3", MaxStamina: 10, Stamina: 10},
	}); err != nil {
		return nil, err
	}

	// Seed decks
	_ = deckRepo.Seed(ctx, []deck.Deck{
		{ID: "deck_first_day", Type: deck.TypeFirstDay, Name: "First Day Deck", Description: "Bootstrap deck", Status: deck.StatusUnlocked, BaseCost: 0, TimesOpened: 0},
		{ID: "deck_organization", Type: deck.TypeOrganization, Name: "Organization Deck", Description: "Workflow modifiers", Status: deck.StatusLocked, BaseCost: 2, TimesOpened: 0},
		{ID: "deck_maintenance", Type: deck.TypeMaintenance, Name: "Maintenance Deck", Description: "Upkeep tools", Status: deck.StatusLocked, BaseCost: 3, TimesOpened: 0},
		{ID: "deck_planning", Type: deck.TypePlanning, Name: "Planning Deck", Description: "Progress materials", Status: deck.StatusLocked, BaseCost: 4, TimesOpened: 0},
		{ID: "deck_integration", Type: deck.TypeIntegration, Name: "Integration Deck", Description: "Advanced materials", Status: deck.StatusLocked, BaseCost: 6, TimesOpened: 0},
	})

	// Seed buildings
	_ = buildingRepo.Seed(ctx, []building.Building{
		{ID: "b_project_board", Type: building.TypeProjectBoard, Name: "Project Board", Description: "Organize into project zones", Effect: "Projects become zones", Status: building.StatusLocked},
		{ID: "b_rest_hall", Type: building.TypeRestHall, Name: "Rest Hall", Description: "Villager recovery", Effect: "+1 stamina to all villagers", Status: building.StatusLocked},
		{ID: "b_calendar_console", Type: building.TypeCalendarConsole, Name: "Calendar Console", Description: "Advanced scheduling", Effect: "No schedule token costs", Status: building.StatusLocked},
		{ID: "b_routine_farm", Type: building.TypeRoutineFarm, Name: "Routine Farm", Description: "Automate recurring", Effect: "Auto-execute recurring tasks", Status: building.StatusLocked},
		{ID: "b_automation_forge", Type: building.TypeAutomationForge, Name: "Automation Forge", Description: "Build automation", Effect: "Unlock automation rules", Status: building.StatusLocked},
	})

	// Give starter loot
	inv, _ := lootRepo.Get(ctx)
	inv.Coin = 10
	inv.Paper = 3
	inv.Ink = 2
	_ = lootRepo.Update(ctx, inv)

	// Seed "real" recipes
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
	})

	// Seed quest system with Week 1 content
	_ = questRepo.Seed(ctx, quest.SeedQuests())
	// Activate the first story quest
	_ = questRepo.Activate(ctx, "W01_Awakening")
	// Initialize quest service with repo-based evaluator
	questEvaluator := quest.NewRepoBasedEvaluator(taskRepo)
	questService := quest.NewService(questRepo, questEvaluator)
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

	// Seed 10 diverse tasks to showcase all features
	_, _ = taskRepo.Create(ctx, "pick up eggs", "from the store")
	_, _ = taskRepo.Create(ctx, "write weekly report", "admin work")
	_, _ = taskRepo.Create(ctx, "update dependencies", "maintenance task")
	_, _ = taskRepo.Create(ctx, "plan Q2 roadmap", "strategic planning")
	_, _ = taskRepo.Create(ctx, "deep work: refactor API", "focused coding session")
	_, _ = taskRepo.Create(ctx, "review pull requests", "code review")
	_, _ = taskRepo.Create(ctx, "clean up desktop", "quick cleanup")
	_, _ = taskRepo.Create(ctx, "schedule 1:1 meetings", "calendar admin")
	_, _ = taskRepo.Create(ctx, "research new framework", "learning")
	_, _ = taskRepo.Create(ctx, "respond to emails", "inbox zero")

	// Initialize order values for all tasks
	taskRepo.InitializeOrderValues()

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
		QuestService: questService,
		RecipeRepo:   recipeRepo,
		VillagerRepo: villagerRepo,
		ZombieRepo:   zombieRepo,
		WorldRepo:    worldRepo,
		ModifierRepo: modifierRepo,
		LootRepo:     lootRepo,
		DeckRepo:     deckRepo,
		BuildingRepo: buildingRepo,
		ProjectRepo:  projectRepo,
		BootNow:      bootNow,
	}, nil
}

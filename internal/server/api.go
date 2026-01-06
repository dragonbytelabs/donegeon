package server

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"strconv"
	"time"

	"donegeon/internal/building"
	"donegeon/internal/deck"
	"donegeon/internal/game"
	"donegeon/internal/loot"
	"donegeon/internal/modifier"
	"donegeon/internal/project"
	"donegeon/internal/quest"
	"donegeon/internal/recipe"
	"donegeon/internal/task"
	"donegeon/internal/villager"
	"donegeon/internal/world"
	"donegeon/internal/zombie"
	"donegeon/web"
)

// App holds the in-memory state for the server.
// This makes it obvious what the handlers depend on.
type App struct {
	Engine       game.Engine
	TaskRepo     *task.MemoryRepo
	QuestRepo    *quest.MemoryRepo
	QuestService *quest.Service
	RecipeRepo   *recipe.MemoryRepo
	VillagerRepo *villager.MemoryRepo
	ZombieRepo   *zombie.MemoryRepo
	WorldRepo    *world.MemoryRepo
	ModifierRepo *modifier.MemoryRepo
	LootRepo     *loot.MemoryRepo
	DeckRepo     *deck.MemoryRepo
	BuildingRepo *building.MemoryRepo
	ProjectRepo  *project.MemoryRepo

	BootNow time.Time
}

type API struct {
	App *App
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

func distFS() http.Handler {
	dist, err := fs.Sub(web.DistFS, "dist")
	if err != nil {
		log.Fatal(err)
	}
	return http.FileServer(http.FS(dist))
}

func RegisterStatic(mux *http.ServeMux) {
	mux.Handle("GET /assets/{file...}", distFS())

	mux.HandleFunc("GET /favicon.ico", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFileFS(w, r, web.DistFS, "dist/favicon.ico")
	})
	mux.HandleFunc("GET /favicon-32.png", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFileFS(w, r, web.DistFS, "dist/favicon-32.png")
	})

	mux.HandleFunc("GET /{rest...}", func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/":
			http.ServeFileFS(w, r, web.DistFS, "dist/index.html")
			return
		case len(r.URL.Path) >= 5 && r.URL.Path[:5] == "/api/":
			http.NotFound(w, r)
			return
		case len(r.URL.Path) >= 8 && r.URL.Path[:8] == "/assets/":
			http.NotFound(w, r)
			return
		default:
			http.ServeFileFS(w, r, web.DistFS, "dist/index.html")
		}
	})
}

func RegisterAPIRoutes(mux *http.ServeMux, rr *RouteRegistry, app *App) {
	engine := app.Engine
	taskRepo := app.TaskRepo
	questRepo := app.QuestRepo
	recipeRepo := app.RecipeRepo
	villagerRepo := app.VillagerRepo
	zombieRepo := app.ZombieRepo
	worldRepo := app.WorldRepo
	modifierRepo := app.ModifierRepo
	lootRepo := app.LootRepo
	deckRepo := app.DeckRepo
	buildingRepo := app.BuildingRepo
	projectRepo := app.ProjectRepo

	// List tasks
	Handle(mux, rr, "GET /api/tasks", "List tasks", "", func(w http.ResponseWriter, r *http.Request) {
		tasks, err := taskRepo.List(r.Context())
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, tasks)
	})

	// Create task
	Handle(mux, rr, "POST /api/tasks", "Create task", `{"name":"pay bills","description":"electric + water"}`, func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name        string `json:"name"`
			Description string `json:"description"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid json body", 400)
			return
		}
		if body.Name == "" {
			http.Error(w, "name is required", 400)
			return
		}

		t, err := taskRepo.Create(r.Context(), body.Name, body.Description)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		_ = engine.Progress(r.Context())

		// Update quest progress after creating task
		if app.QuestService != nil {
			_ = app.QuestService.RefreshProgress(r.Context())
		}

		writeJSON(w, t)
	})

	Handle(mux, rr, "POST /api/tasks/tag", "Add tag to task", `{"id":1,"tag":"home"}`, func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			ID  int    `json:"id"`
			Tag string `json:"tag"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid json body", 400)
			return
		}
		t, ok, err := taskRepo.AddTag(r.Context(), body.ID, body.Tag)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		if !ok {
			http.Error(w, "task not found", 404)
			return
		}
		_ = engine.Progress(r.Context())
		writeJSON(w, t)
	})

	Handle(mux, rr, "POST /api/tasks/complete", "Complete a task", `{"id":1}`, func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			ID int `json:"id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid json body", 400)
			return
		}

		result, err := engine.CompleteTask(r.Context(), body.ID)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		// Update quest progress after completing task
		if app.QuestService != nil {
			_ = app.QuestService.RefreshProgress(r.Context())
		}

		writeJSON(w, result)
	})

	Handle(mux, rr, "POST /api/tasks/move-to-live", "Move task from inbox to live", `{"id":1}`, func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			ID int `json:"id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid json body", 400)
			return
		}

		t, ok, err := taskRepo.Process(r.Context(), body.ID)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		if !ok {
			http.Error(w, "task not found", 404)
			return
		}

		_ = engine.Progress(r.Context())
		writeJSON(w, t)
	})

	Handle(mux, rr, "POST /api/tasks/process", "Process a task (mark as worked today)", `{"task_id":1,"villager_id":"v1","hours_worked":1}`, func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			TaskID      int     `json:"task_id"`
			VillagerID  string  `json:"villager_id"`
			HoursWorked float64 `json:"hours_worked"` // How many hours of work (default 1)
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid json body", 400)
			return
		}

		// Default to 1 hour if not specified
		if body.HoursWorked <= 0 {
			body.HoursWorked = 1
		}

		// Get the task
		t, found, err := taskRepo.Get(r.Context(), body.TaskID)
		if err != nil || !found {
			http.Error(w, "task not found", 404)
			return
		}

		// Get the villager
		v, found, err := villagerRepo.Get(r.Context(), body.VillagerID)
		if err != nil || !found {
			http.Error(w, "villager not found", 404)
			return
		}

		// Check villager has stamina
		if v.Stamina <= 0 {
			http.Error(w, "villager has no stamina", 400)
			return
		}

		// Move task to live if it's in inbox
		if t.Zone == task.ZoneInbox {
			t.MoveToLive()
		}

		// Start work tracking if not already started
		t.StartWork()

		// Add work progress based on villager speed
		isComplete := t.AddWorkProgress(v.Speed, body.HoursWorked)

		// Consume 1 stamina from villager
		v.Stamina--
		if _, err := villagerRepo.Update(r.Context(), v); err != nil {
			http.Error(w, fmt.Sprintf("failed to update villager: %v", err), 500)
			return
		}

		// If task is complete, mark it as completed
		if isComplete {
			_, err := engine.CompleteTask(r.Context(), t.ID)
			if err != nil {
				http.Error(w, fmt.Sprintf("failed to complete task: %v", err), 500)
				return
			}

			// Update quest progress after completing task
			if app.QuestService != nil {
				_ = app.QuestService.RefreshProgress(r.Context())
			}

			// Re-fetch the completed task
			t, _, _ = taskRepo.Get(r.Context(), body.TaskID)
		} else {
			// Update task with progress
			if _, err := taskRepo.Update(r.Context(), t); err != nil {
				http.Error(w, fmt.Sprintf("failed to update task: %v", err), 500)
				return
			}
		}

		writeJSON(w, map[string]any{
			"status":   "processed",
			"task":     t,
			"villager": v,
		})
	})

	Handle(mux, rr, "POST /api/tasks/set-project", "Assign task to project", `{"task_id":1,"project_id":2}`, func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			TaskID    int  `json:"task_id"`
			ProjectID *int `json:"project_id"` // null to unassign
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid json body", 400)
			return
		}

		// Get the task
		t, found, err := taskRepo.Get(r.Context(), body.TaskID)
		if err != nil || !found {
			http.Error(w, "task not found", 404)
			return
		}

		// If project_id is provided, verify it exists
		if body.ProjectID != nil {
			_, found, err := projectRepo.Get(r.Context(), *body.ProjectID)
			if err != nil || !found {
				http.Error(w, "project not found", 404)
				return
			}
		}

		// Assign project
		t.ProjectID = body.ProjectID

		// Update task
		if _, err := taskRepo.Update(r.Context(), t); err != nil {
			http.Error(w, fmt.Sprintf("failed to update task: %v", err), 500)
			return
		}

		writeJSON(w, t)
	})

	Handle(mux, rr, "POST /api/tasks/reorder", "Reorder tasks", `{"source_id":1,"target_id":2}`, func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			SourceID int `json:"source_id"`
			TargetID int `json:"target_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid json body", 400)
			return
		}

		if err := taskRepo.Reorder(r.Context(), body.SourceID, body.TargetID); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, map[string]string{"status": "ok"})
	})

	Handle(mux, rr, "GET /api/tasks/inbox", "List Inbox tasks", "", func(w http.ResponseWriter, r *http.Request) {
		tasks, err := taskRepo.ListByZone(r.Context(), task.ZoneInbox)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, tasks)
	})

	Handle(mux, rr, "GET /api/tasks/live", "List Live tasks", "", func(w http.ResponseWriter, r *http.Request) {
		tasks, err := taskRepo.ListByZone(r.Context(), task.ZoneLive)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, tasks)
	})

	Handle(mux, rr, "GET /api/tasks/completed", "List Completed tasks", "", func(w http.ResponseWriter, r *http.Request) {
		tasks, err := taskRepo.ListByZone(r.Context(), task.ZoneCompleted)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, tasks)
	})

	Handle(mux, rr, "GET /api/tasks/{id}/modifiers", "List modifiers for a task", "", func(w http.ResponseWriter, r *http.Request) {
		idStr := r.PathValue("id")
		id, err := strconv.Atoi(idStr)
		if err != nil {
			http.Error(w, "invalid task id", 400)
			return
		}

		tk, ok, err := taskRepo.Get(r.Context(), id)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		if !ok {
			http.Error(w, "task not found", 404)
			return
		}

		out := make([]modifier.Card, 0, len(tk.ModifierIDs))
		for _, mid := range tk.ModifierIDs {
			c, ok, err := modifierRepo.Get(r.Context(), mid)
			if err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			if ok {
				out = append(out, c)
			}
		}

		writeJSON(w, out)
	})

	Handle(mux, rr, "GET /api/quests", "List quests", "", func(w http.ResponseWriter, r *http.Request) {
		qs, err := questRepo.List(r.Context())
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, qs)
	})

	Handle(mux, rr, "GET /api/quests/active", "List active quests", "", func(w http.ResponseWriter, r *http.Request) {
		var qs []quest.Quest
		var err error

		// Use service if available for auto-refresh
		if app.QuestService != nil {
			qs, err = app.QuestService.GetActiveQuests(r.Context())
		} else {
			qs, err = questRepo.ListActive(r.Context())
		}

		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, qs)
	})

	Handle(mux, rr, "GET /api/quests/daily", "List daily quests", "", func(w http.ResponseWriter, r *http.Request) {
		qs, err := questRepo.ListByType(r.Context(), quest.TypeDaily)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, qs)
	})

	Handle(mux, rr, "POST /api/quests/{id}/complete", "Complete and claim quest", `{}`, func(w http.ResponseWriter, r *http.Request) {
		idStr := r.PathValue("id")

		var rewards []quest.Reward
		var err error

		// Use service if available
		if app.QuestService != nil {
			rewards, err = app.QuestService.ClaimRewards(r.Context(), idStr)
		} else {
			// Fallback to direct repo access
			if err := questRepo.Complete(r.Context(), idStr); err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			q, ok, err := questRepo.Get(r.Context(), idStr)
			if err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			if !ok {
				http.Error(w, "quest not found", 404)
				return
			}
			rewards = q.Rewards
		}

		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		// Unlock next story quest after completing one
		if app.QuestService != nil {
			if err := app.QuestService.UnlockNextStoryQuest(r.Context()); err != nil {
				// Log error but don't fail the claim
				log.Printf("Quest unlock error: %v", err)
			}
		}

		// Return rewards
		writeJSON(w, map[string]any{
			"rewards": rewards,
		})
	})

	Handle(mux, rr, "POST /api/quests/refresh", "Refresh quest progress", `{}`, func(w http.ResponseWriter, r *http.Request) {
		if app.QuestService != nil {
			if err := app.QuestService.RefreshProgress(r.Context()); err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
		}
		writeJSON(w, map[string]string{"status": "ok"})
	})

	Handle(mux, rr, "GET /api/recipes", "List recipes", "", func(w http.ResponseWriter, r *http.Request) {
		recs, err := recipeRepo.List(r.Context())
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, recs)
	})

	Handle(mux, rr, "POST /api/recipes/craft", "Craft a recipe", `{"recipe_id":"r_make_omelet"}`, func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			RecipeID string `json:"recipe_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid json body", 400)
			return
		}
		if body.RecipeID == "" {
			http.Error(w, "recipe_id is required", 400)
			return
		}

		res, err := engine.Craft(r.Context(), body.RecipeID)
		if err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		writeJSON(w, res)
	})

	Handle(mux, rr, "POST /api/progress", "Progress quests/recipes based on current live tasks", `{}`, func(w http.ResponseWriter, r *http.Request) {
		if err := engine.Progress(r.Context()); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, map[string]any{"ok": true})
	})

	Handle(mux, rr, "GET /api/villagers", "List villagers", "", func(w http.ResponseWriter, r *http.Request) {
		vs, err := villagerRepo.List(r.Context())
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, vs)
	})

	Handle(mux, rr, "GET /api/zombies", "List zombies", "", func(w http.ResponseWriter, r *http.Request) {
		zs, err := zombieRepo.List(r.Context())
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, zs)
	})

	Handle(mux, rr, "GET /api/world", "Get world state", "", func(w http.ResponseWriter, r *http.Request) {
		ww, err := worldRepo.Get(r.Context())
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, ww)
	})

	Handle(mux, rr, "POST /api/day/tick", "Advance day and spawn zombies / apply effects", `{}`, func(w http.ResponseWriter, r *http.Request) {
		res, err := engine.DayTick(r.Context())
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		// Process end-of-day quest progression
		if app.QuestService != nil {
			if err := app.QuestService.ProcessDayEnd(r.Context()); err != nil {
				// Log error but don't fail the day tick
				log.Printf("Quest progression error: %v", err)
			}
		}

		writeJSON(w, res)
	})

	Handle(mux, rr, "POST /api/zombies/clear", "Clear a zombie using villager slots", `{"zombie_id":"z_...","slots":1}`, func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			ZombieID string `json:"zombie_id"`
			Slots    int    `json:"slots"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid json body", 400)
			return
		}
		if body.ZombieID == "" {
			http.Error(w, "zombie_id is required", 400)
			return
		}

		res, err := engine.ClearZombie(r.Context(), body.ZombieID, body.Slots)
		if err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		writeJSON(w, res)
	})

	Handle(mux, rr, "GET /api/modifiers", "List all modifiers", "", func(w http.ResponseWriter, r *http.Request) {
		ms, err := modifierRepo.List(r.Context())
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, ms)
	})

	// NOTE: your modifier add endpoint has a couple logic bugs; I fixed them below:
	// - uses engine.Clock.Now() consistently
	// - NextAt logic was reversed
	Handle(mux, rr, "POST /api/tasks/modifiers/add", "Attach modifier to a task",
		`{"task_id":1,"type":"deadline_pin","deadline_at":"2026-01-03T05:00:00Z"}`,
		func(w http.ResponseWriter, r *http.Request) {
			var body struct {
				TaskID int           `json:"task_id"`
				Type   modifier.Type `json:"type"`

				DeadlineAt string `json:"deadline_at"` // RFC3339
				EveryDays  int    `json:"every_days"`
				NextAt     string `json:"next_at"` // RFC3339

				Charges int `json:"charges"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				http.Error(w, "invalid json body", 400)
				return
			}
			if body.TaskID == 0 {
				http.Error(w, "task_id is required", 400)
				return
			}
			if body.Type == "" {
				http.Error(w, "type is required", 400)
				return
			}

			now := engine.Clock.Now()
			card := modifier.Card{
				ID:        fmt.Sprintf("m_%d_%d", body.TaskID, now.UnixNano()),
				Type:      body.Type,
				CreatedAt: now,
				Status:    modifier.StatusActive,
			}

			switch body.Type {
			case modifier.DeadlinePin:
				card.MaxCharges = 0
				card.Charges = 0

				if body.DeadlineAt == "" {
					http.Error(w, "deadline_at is required for deadline_pin", 400)
					return
				}
				dt, err := time.Parse(time.RFC3339, body.DeadlineAt)
				if err != nil {
					http.Error(w, "deadline_at must be RFC3339", 400)
					return
				}
				card.DeadlineAt = &dt

			case modifier.ImportanceSeal:
				card.MaxCharges = 3
				card.Charges = 3

			case modifier.ScheduleToken:
				card.MaxCharges = 2
				card.Charges = 2
				if body.DeadlineAt != "" {
					st, err := time.Parse(time.RFC3339, body.DeadlineAt)
					if err != nil {
						http.Error(w, "deadline_at must be RFC3339 (used as scheduled_at)", 400)
						return
					}
					card.ScheduledAt = &st
				}

			case modifier.RecurringContract:
				if body.EveryDays <= 0 {
					http.Error(w, "every_days is required for recurring_contract", 400)
					return
				}
				card.RecurringEveryDays = body.EveryDays

				max := 4
				if body.Charges > 0 {
					max = body.Charges
				}
				card.MaxCharges = max
				card.Charges = max

				// NextAt: if provided, parse it; else default to now + EveryDays
				if body.NextAt != "" {
					na, err := time.Parse(time.RFC3339, body.NextAt)
					if err != nil {
						http.Error(w, "next_at must be RFC3339", 400)
						return
					}
					card.RecurringNextAt = &na
				} else {
					na := now.AddDate(0, 0, body.EveryDays)
					card.RecurringNextAt = &na
				}

			default:
				http.Error(w, "unknown modifier type", 400)
				return
			}

			// If you added Normalize/Validate in modifier.Card, keep these.
			// If not, remove these lines.
			card.Normalize()
			if err := card.Validate(); err != nil {
				http.Error(w, err.Error(), 400)
				return
			}

			res, err := engine.AttachModifier(r.Context(), body.TaskID, card)
			if err != nil {
				http.Error(w, err.Error(), 400)
				return
			}
			writeJSON(w, res)
		},
	)

	Handle(mux, rr, "POST /api/tasks/modifiers/remove", "Detach modifier from a task",
		`{"task_id":1,"modifier_id":"m_..."}`,
		func(w http.ResponseWriter, r *http.Request) {
			var body struct {
				TaskID     int    `json:"task_id"`
				ModifierID string `json:"modifier_id"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				http.Error(w, "invalid json body", 400)
				return
			}
			if body.TaskID == 0 || body.ModifierID == "" {
				http.Error(w, "task_id and modifier_id required", 400)
				return
			}

			tk, err := engine.DetachModifier(r.Context(), body.TaskID, body.ModifierID)
			if err != nil {
				http.Error(w, err.Error(), 400)
				return
			}
			writeJSON(w, tk)
		},
	)

	// Board stacking actions
	Handle(mux, rr, "POST /api/tasks/assign", "Assign task to villager",
		`{"task_id":1,"villager_id":"v1"}`,
		func(w http.ResponseWriter, r *http.Request) {
			var body struct {
				TaskID     int    `json:"task_id"`
				VillagerID string `json:"villager_id"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				http.Error(w, "invalid json body", 400)
				return
			}

			// Get villager
			v, ok, err := villagerRepo.Get(r.Context(), body.VillagerID)
			if err != nil || !ok {
				http.Error(w, "villager not found", 404)
				return
			}

			// Get task first to determine stamina cost
			tk, ok, err := taskRepo.Get(r.Context(), body.TaskID)
			if err != nil || !ok {
				http.Error(w, "task not found", 404)
				return
			}

			// Calculate stamina cost based on task tags
			staminaCost := 1 // default
			for _, tag := range tk.Tags {
				switch tag {
				case "deep_work":
					staminaCost = 3
				case "admin":
					staminaCost = 1
				case "quick":
					staminaCost = 1
				case "meeting":
					staminaCost = 2
				}
			}

			// Check if villager has enough stamina
			if v.Stamina < staminaCost {
				http.Error(w, "villager has insufficient stamina", 400)
				return
			}

			// Consume stamina
			v.Stamina -= staminaCost
			_, err = villagerRepo.Update(r.Context(), v)
			if err != nil {
				http.Error(w, err.Error(), 500)
				return
			}

			// Mark task as assigned to this villager
			tk.AssignedVillager = body.VillagerID
			if tk.Zone != task.ZoneLive {
				tk, _, err = taskRepo.Process(r.Context(), body.TaskID)
				if err != nil {
					http.Error(w, err.Error(), 500)
					return
				}
			} else {
				// Update task with assignment
				_, err = taskRepo.Update(r.Context(), tk)
				if err != nil {
					http.Error(w, err.Error(), 500)
					return
				}
			}

			writeJSON(w, tk)
		},
	)

	Handle(mux, rr, "POST /api/tasks/modifiers/attach", "Attach modifier card to task",
		`{"task_id":1,"modifier":{"id":"m_123","type":"deadline_pin"}}`,
		func(w http.ResponseWriter, r *http.Request) {
			var body struct {
				TaskID   int           `json:"task_id"`
				Modifier modifier.Card `json:"modifier"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				http.Error(w, "invalid json body", 400)
				return
			}

			res, err := engine.AttachModifier(r.Context(), body.TaskID, body.Modifier)
			if err != nil {
				http.Error(w, err.Error(), 400)
				return
			}
			writeJSON(w, res)
		},
	)

	// Loot / Inventory
	Handle(mux, rr, "GET /api/loot", "Get loot inventory", "", func(w http.ResponseWriter, r *http.Request) {
		inv, err := lootRepo.Get(r.Context())
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, inv)
	})

	Handle(mux, rr, "POST /api/loot/collect", "Collect loot from board", `{"loot_type":"coin","amount":5}`, func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			LootType string `json:"loot_type"`
			Amount   int    `json:"amount"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid json body", 400)
			return
		}

		inv, err := lootRepo.Get(r.Context())
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		inv.Add([]loot.Drop{{Type: loot.Type(body.LootType), Amount: body.Amount}})

		if err := lootRepo.Update(r.Context(), inv); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		writeJSON(w, inv)
	})

	// Decks
	Handle(mux, rr, "GET /api/decks", "List all decks", "", func(w http.ResponseWriter, r *http.Request) {
		decks, err := deckRepo.List(r.Context())
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, decks)
	})

	Handle(mux, rr, "POST /api/decks/{id}/open", "Open a deck/pack", "", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		result, err := engine.OpenDeck(r.Context(), id)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, result)
	})

	// Buildings
	Handle(mux, rr, "GET /api/buildings", "List all buildings", "", func(w http.ResponseWriter, r *http.Request) {
		buildings, err := buildingRepo.List(r.Context())
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, buildings)
	})

	Handle(mux, rr, "POST /api/buildings/construct", "Construct a building", `{"type":"rest_hall"}`, func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Type string `json:"type"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid json body", 400)
			return
		}

		result, err := engine.ConstructBuilding(r.Context(), building.Type(body.Type))
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, result)
	})

	// Project endpoints
	Handle(mux, rr, "GET /api/projects", "List all projects", "", func(w http.ResponseWriter, r *http.Request) {
		projects, err := projectRepo.List(r.Context())
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, projects)
	})

	Handle(mux, rr, "POST /api/projects", "Create a project", `{"name":"My Project","description":"Project description"}`, func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name        string `json:"name"`
			Description string `json:"description"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid json body", 400)
			return
		}

		proj, err := projectRepo.Create(r.Context(), body.Name, body.Description)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, proj)
	})

	Handle(mux, rr, "POST /api/projects/{id}/archive", "Archive a project", "", func(w http.ResponseWriter, r *http.Request) {
		idStr := r.PathValue("id")
		id, err := strconv.Atoi(idStr)
		if err != nil {
			http.Error(w, "invalid project id", 400)
			return
		}

		proj, ok, err := projectRepo.Get(r.Context(), id)
		if err != nil || !ok {
			http.Error(w, "project not found", 404)
			return
		}

		proj.Archive()
		proj, err = projectRepo.Update(r.Context(), proj)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, proj)
	})

	// Game state endpoints
	Handle(mux, rr, "GET /api/game/state", "Get game state", "", func(w http.ResponseWriter, r *http.Request) {
		state, err := engine.GameState.Get(r.Context())
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, state)
	})

	Handle(mux, rr, "GET /api/game/remaining-undrawn", "Get count of undrawn tasks", "", func(w http.ResponseWriter, r *http.Request) {
		count, err := engine.RemainingUndrawn(r.Context())
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, map[string]int{"remaining_undrawn": count})
	})

	Handle(mux, rr, "GET /api/today", "Get today's summary", "", func(w http.ResponseWriter, r *http.Request) {
		summary, err := engine.TodaySummary(r.Context())
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, summary)
	})

	// Card management endpoints
	Handle(mux, rr, "GET /api/cards", "List all cards", "", func(w http.ResponseWriter, r *http.Request) {
		cards, err := engine.Cards.List(r.Context())
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, cards)
	})

	Handle(mux, rr, "GET /api/cards/zone/{zone}", "List cards by zone", "", func(w http.ResponseWriter, r *http.Request) {
		zone := r.PathValue("zone")
		cards, err := engine.Cards.ListByZone(r.Context(), game.CardZone(zone))
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, cards)
	})
}

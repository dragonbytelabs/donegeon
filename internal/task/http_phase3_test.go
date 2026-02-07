package task

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"donegeon/internal/config"
	"donegeon/internal/model"
	"donegeon/internal/player"
)

func newTaskHandlerForTests(t *testing.T, requireAssigned bool) (*Handler, *MemoryRepo, *player.FileRepo) {
	t.Helper()

	taskRepo := NewMemoryRepo()
	playerRepo, err := player.NewFileRepo(t.TempDir())
	if err != nil {
		t.Fatalf("new player repo: %v", err)
	}
	playerRepo = playerRepo.ForUser("u-test")

	h := NewHandler(taskRepo)
	h.SetConfig(&config.Config{
		Villagers: config.Villagers{
			Defaults: config.VillagerDefaults{
				BaseMaxStamina: 6,
			},
			Actions: config.VillagerActions{
				WorkTask: config.ActionCost{
					StaminaCost: 1,
				},
			},
		},
		Tasks: config.Tasks{
			Processing: config.TaskProcessing{
				CompletionRequiresAssignedVillager: requireAssigned,
			},
		},
	})
	h.SetPlayerResolver(func(_ *http.Request) *player.FileRepo {
		return playerRepo
	})
	return h, taskRepo, playerRepo
}

func jsonReq(method, path string, body any) *http.Request {
	var b []byte
	if body != nil {
		b, _ = json.Marshal(body)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	return req
}

func TestTasksRoot_CreateLockedFieldsDenied(t *testing.T) {
	h, _, _ := newTaskHandlerForTests(t, false)

	tests := []struct {
		name string
		body map[string]any
	}{
		{
			name: "due date locked",
			body: map[string]any{
				"title":     "A",
				"done":      false,
				"dueDate":   "2026-02-08",
				"modifiers": []any{},
			},
		},
		{
			name: "next action locked",
			body: map[string]any{
				"title":      "B",
				"done":       false,
				"nextAction": true,
				"modifiers":  []any{},
			},
		},
		{
			name: "recurrence locked",
			body: map[string]any{
				"title":      "C",
				"done":       false,
				"recurrence": map[string]any{"type": "weekly", "interval": 1},
				"modifiers":  []any{},
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			h.TasksRoot(rec, jsonReq(http.MethodPost, "/api/tasks", tc.body))
			if rec.Code != http.StatusForbidden {
				t.Fatalf("expected 403, got %d body=%s", rec.Code, rec.Body.String())
			}
		})
	}
}

func TestTasksSub_CompletionRequiresAssignedVillager(t *testing.T) {
	h, repo, _ := newTaskHandlerForTests(t, true)
	inbox := "inbox"
	created, err := repo.Create(model.Task{
		Title:   "Take out trash",
		Project: &inbox,
	})
	if err != nil {
		t.Fatalf("create task: %v", err)
	}

	rec := httptest.NewRecorder()
	h.TasksSub(rec, jsonReq(http.MethodPatch, "/api/tasks/"+string(created.ID), map[string]any{
		"done": true,
	}))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 without assignment, got %d body=%s", rec.Code, rec.Body.String())
	}

	assigned := "villager_stack_1"
	if _, err := repo.Update(created.ID, Patch{AssignedVillagerID: &assigned}); err != nil {
		t.Fatalf("assign villager: %v", err)
	}

	rec = httptest.NewRecorder()
	h.TasksSub(rec, jsonReq(http.MethodPatch, "/api/tasks/"+string(created.ID), map[string]any{
		"done": true,
	}))
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 with assignment, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestTasksSub_ProcessRequiresAssignmentAndUpdatesProgress(t *testing.T) {
	h, repo, _ := newTaskHandlerForTests(t, true)
	inbox := "inbox"
	created, err := repo.Create(model.Task{
		Title:   "Process me",
		Project: &inbox,
	})
	if err != nil {
		t.Fatalf("create task: %v", err)
	}

	rec := httptest.NewRecorder()
	h.TasksSub(rec, jsonReq(http.MethodPost, "/api/tasks/"+string(created.ID)+"/process", map[string]any{}))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 without assignment, got %d body=%s", rec.Code, rec.Body.String())
	}

	assigned := "villager_stack_2"
	if _, err := repo.Update(created.ID, Patch{AssignedVillagerID: &assigned}); err != nil {
		t.Fatalf("assign villager: %v", err)
	}

	rec = httptest.NewRecorder()
	h.TasksSub(rec, jsonReq(http.MethodPost, "/api/tasks/"+string(created.ID)+"/process", map[string]any{}))
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for process, got %d body=%s", rec.Code, rec.Body.String())
	}

	got, err := repo.Get(created.ID)
	if err != nil {
		t.Fatalf("get task: %v", err)
	}
	if !got.WorkedToday {
		t.Fatalf("expected workedToday=true after process")
	}
	if got.ProcessedCount != 1 {
		t.Fatalf("expected processedCount=1 after process, got %d", got.ProcessedCount)
	}
	if got.Done {
		t.Fatalf("expected task to remain pending when markDone=false")
	}

	rec = httptest.NewRecorder()
	h.TasksSub(rec, jsonReq(http.MethodPost, "/api/tasks/"+string(created.ID)+"/process", map[string]any{
		"markDone": true,
	}))
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for process+markDone, got %d body=%s", rec.Code, rec.Body.String())
	}
	got, err = repo.Get(created.ID)
	if err != nil {
		t.Fatalf("get task after markDone: %v", err)
	}
	if !got.Done {
		t.Fatalf("expected task to be done after markDone")
	}
	if got.ProcessedCount != 2 {
		t.Fatalf("expected processedCount=2 after second process, got %d", got.ProcessedCount)
	}
}

func TestTasksSub_ProcessConsumesStaminaUntilDepleted(t *testing.T) {
	h, repo, _ := newTaskHandlerForTests(t, true)
	inbox := "inbox"
	created, err := repo.Create(model.Task{
		Title:   "Stamina test",
		Project: &inbox,
	})
	if err != nil {
		t.Fatalf("create task: %v", err)
	}
	assigned := "villager_stack_stamina"
	if _, err := repo.Update(created.ID, Patch{AssignedVillagerID: &assigned}); err != nil {
		t.Fatalf("assign villager: %v", err)
	}

	for i := 0; i < 6; i++ {
		rec := httptest.NewRecorder()
		h.TasksSub(rec, jsonReq(http.MethodPost, "/api/tasks/"+string(created.ID)+"/process", map[string]any{}))
		if rec.Code != http.StatusOK {
			t.Fatalf("expected process %d to succeed, got %d body=%s", i+1, rec.Code, rec.Body.String())
		}
	}

	rec := httptest.NewRecorder()
	h.TasksSub(rec, jsonReq(http.MethodPost, "/api/tasks/"+string(created.ID)+"/process", map[string]any{}))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected process with depleted stamina to fail with 400, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestTasksSub_ToggleDonePreservesTaskDetails(t *testing.T) {
	h, repo, _ := newTaskHandlerForTests(t, false)
	inbox := "inbox"
	due := "2026-02-09"
	project := "home"

	created, err := repo.Create(model.Task{
		Title:       "Take trash out",
		Description: "Thursday night",
		Done:        true,
		Project:     &project,
		Tags:        []string{"home", "weekly"},
		Modifiers: []model.TaskModifierSlot{
			{DefID: "mod.deadline_pin"},
			{DefID: "mod.recurring"},
		},
		DueDate: &due,
		Recurrence: &model.Recurrence{
			Type:     "weekly",
			Interval: 1,
		},
		NextAction: true,
	})
	if err != nil {
		t.Fatalf("create task: %v", err)
	}
	if _, err := repo.Update(created.ID, Patch{Project: &inbox}); err != nil {
		t.Fatalf("set inbox project: %v", err)
	}

	rec := httptest.NewRecorder()
	h.TasksSub(rec, jsonReq(http.MethodPatch, "/api/tasks/"+string(created.ID), map[string]any{
		"done": false,
	}))
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	got, err := repo.Get(created.ID)
	if err != nil {
		t.Fatalf("get task: %v", err)
	}
	if got.Done {
		t.Fatalf("expected task to be pending after toggle")
	}
	if got.Title != "Take trash out" || got.Description != "Thursday night" {
		t.Fatalf("expected title/description to persist, got title=%q desc=%q", got.Title, got.Description)
	}
	if got.Project == nil || *got.Project != inbox {
		t.Fatalf("expected project to persist, got %+v", got.Project)
	}
	if len(got.Tags) != 2 || got.Tags[0] != "home" || got.Tags[1] != "weekly" {
		t.Fatalf("expected tags to persist, got %+v", got.Tags)
	}
	if got.DueDate == nil || *got.DueDate != due {
		t.Fatalf("expected due date to persist, got %+v", got.DueDate)
	}
	if got.Recurrence == nil || got.Recurrence.Type != "weekly" || got.Recurrence.Interval != 1 {
		t.Fatalf("expected recurrence to persist, got %+v", got.Recurrence)
	}
	if !got.NextAction {
		t.Fatalf("expected nextAction to persist")
	}
	if len(got.Modifiers) != 2 {
		t.Fatalf("expected modifiers to persist, got %+v", got.Modifiers)
	}
}

func TestTasksRoot_CreateLockedFieldsAllowedWithAttachedModifier(t *testing.T) {
	h, _, _ := newTaskHandlerForTests(t, false)

	tests := []struct {
		name string
		body map[string]any
	}{
		{
			name: "due date allowed by deadline pin",
			body: map[string]any{
				"title":   "A",
				"dueDate": "2026-02-08",
				"modifiers": []any{
					map[string]any{"defId": "deadline_pin"},
				},
			},
		},
		{
			name: "next action allowed by next action modifier",
			body: map[string]any{
				"title":      "B",
				"nextAction": true,
				"modifiers": []any{
					map[string]any{"defId": "mod.next_action"},
				},
			},
		},
		{
			name: "recurrence allowed by recurring modifier",
			body: map[string]any{
				"title":      "C",
				"recurrence": map[string]any{"type": "weekly", "interval": 1},
				"modifiers": []any{
					map[string]any{"defId": "mod.recurring"},
				},
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			h.TasksRoot(rec, jsonReq(http.MethodPost, "/api/tasks", tc.body))
			if rec.Code != http.StatusCreated {
				t.Fatalf("expected 201, got %d body=%s", rec.Code, rec.Body.String())
			}
		})
	}
}

func TestTasksSub_DoneTransitionUpdatesHabitProgress(t *testing.T) {
	h, repo, playerRepo := newTaskHandlerForTests(t, false)
	inbox := "inbox"
	yesterday := "2026-02-06"
	created, err := repo.Create(model.Task{
		Title:             "Daily standup",
		Project:           &inbox,
		CompletionCount:   6,
		Habit:             false,
		HabitTier:         0,
		HabitStreak:       6,
		LastCompletedDate: &yesterday,
	})
	if err != nil {
		t.Fatalf("create task: %v", err)
	}

	rec := httptest.NewRecorder()
	h.TasksSub(rec, jsonReq(http.MethodPatch, "/api/tasks/"+string(created.ID), map[string]any{
		"done": true,
	}))
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	got, err := repo.Get(created.ID)
	if err != nil {
		t.Fatalf("get task: %v", err)
	}
	if got.CompletionCount != 7 {
		t.Fatalf("expected completionCount=7, got %d", got.CompletionCount)
	}
	if !got.Habit || got.HabitTier != 1 {
		t.Fatalf("expected habit tier 1, got habit=%v tier=%d", got.Habit, got.HabitTier)
	}
	if got.HabitStreak != 7 {
		t.Fatalf("expected habit streak 7, got %d", got.HabitStreak)
	}
	if got.LastCompletedDate == nil || *got.LastCompletedDate == "" {
		t.Fatalf("expected lastCompletedDate to be set")
	}
	if coin := playerRepo.GetState().Loot[player.LootCoin]; coin < 2 {
		t.Fatalf("expected habit bonus coin reward, got %d", coin)
	}
	if completed := playerRepo.GetMetric(player.MetricTasksCompleted); completed < 1 {
		t.Fatalf("expected tasks completed metric incremented, got %d", completed)
	}
}

func TestTasksSub_PatchLockedFieldsAllowedWithAttachedModifier(t *testing.T) {
	h, repo, _ := newTaskHandlerForTests(t, false)
	inbox := "inbox"

	makeTask := func(title string, mods []model.TaskModifierSlot) model.Task {
		t.Helper()
		created, err := repo.Create(model.Task{
			Title:     title,
			Project:   &inbox,
			Modifiers: mods,
		})
		if err != nil {
			t.Fatalf("create task %q: %v", title, err)
		}
		return created
	}

	withPatch := func(id model.TaskID, body map[string]any) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		h.TasksSub(rec, jsonReq(http.MethodPatch, "/api/tasks/"+string(id), body))
		return rec
	}

	t.Run("due date allowed when modifier supplied in same patch", func(t *testing.T) {
		task := makeTask("due", nil)
		rec := withPatch(task.ID, map[string]any{
			"dueDate": "2026-02-08",
			"modifiers": []any{
				map[string]any{"defId": "mod.deadline_pin"},
			},
		})
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("next action allowed when modifier already attached", func(t *testing.T) {
		task := makeTask("next", []model.TaskModifierSlot{
			{DefID: "mod.next_action"},
		})
		rec := withPatch(task.ID, map[string]any{
			"nextAction": true,
		})
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("recurrence allowed when recurring modifier already attached", func(t *testing.T) {
		task := makeTask("rec", []model.TaskModifierSlot{
			{DefID: "mod.recurring_contract"},
		})
		rec := withPatch(task.ID, map[string]any{
			"recurrence": map[string]any{"type": "weekly", "interval": 2},
		})
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
		}
	})
}

func TestTasksSub_CalendarExportICS(t *testing.T) {
	h, repo, _ := newTaskHandlerForTests(t, false)
	inbox := "inbox"
	due := "2026-02-12"
	created, err := repo.Create(model.Task{
		Title:       "Take out trash",
		Description: "Thursday night run",
		Project:     &inbox,
		DueDate:     &due,
		Recurrence: &model.Recurrence{
			Type:     "weekly",
			Interval: 2,
		},
	})
	if err != nil {
		t.Fatalf("create task: %v", err)
	}

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/tasks/"+string(created.ID)+"/calendar.ics", nil)
	h.TasksSub(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "text/calendar") {
		t.Fatalf("expected text/calendar content type, got %q", ct)
	}

	body := rec.Body.String()
	for _, want := range []string{
		"BEGIN:VCALENDAR",
		"BEGIN:VEVENT",
		"SUMMARY:Take out trash",
		"DESCRIPTION:Thursday night run",
		"DTSTART;VALUE=DATE:20260212",
		"RRULE:FREQ=WEEKLY;INTERVAL=2",
		"END:VEVENT",
		"END:VCALENDAR",
	} {
		if !strings.Contains(body, want) {
			t.Fatalf("expected calendar export to contain %q; body=%s", want, body)
		}
	}
}

func TestTasksSub_CalendarExportRequiresDueDate(t *testing.T) {
	h, repo, _ := newTaskHandlerForTests(t, false)
	inbox := "inbox"
	created, err := repo.Create(model.Task{
		Title:   "No due",
		Project: &inbox,
	})
	if err != nil {
		t.Fatalf("create task: %v", err)
	}

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/tasks/"+string(created.ID)+"/calendar.ics", nil)
	h.TasksSub(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing due date, got %d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "task due date required") {
		t.Fatalf("expected due-date-required error, got body=%s", rec.Body.String())
	}
}

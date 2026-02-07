package task

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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

package quest

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"donegeon/internal/model"
	"donegeon/internal/player"
	"donegeon/internal/task"
)

func TestState_ComputesQuestProgressFromTasksAndMetrics(t *testing.T) {
	taskRepo := task.NewMemoryRepo()
	playerRepo, err := player.NewFileRepo(t.TempDir())
	if err != nil {
		t.Fatalf("new player repo: %v", err)
	}
	playerRepo = playerRepo.ForUser("u-quests")

	inbox := "inbox"
	villager := "villager_1"
	doneTask, err := taskRepo.Create(model.Task{
		Title:              "Done today",
		Project:            &inbox,
		Done:               true,
		AssignedVillagerID: &villager,
	})
	if err != nil {
		t.Fatalf("create done task: %v", err)
	}
	done := true
	if _, err := taskRepo.Update(doneTask.ID, task.Patch{Done: &done}); err != nil {
		t.Fatalf("update done task: %v", err)
	}
	if _, err := taskRepo.Create(model.Task{
		Title:              "Pending assigned",
		Project:            &inbox,
		AssignedVillagerID: &villager,
	}); err != nil {
		t.Fatalf("create pending task: %v", err)
	}

	if _, _, err := playerRepo.IncrementMetric(player.MetricTasksCompleted, 12); err != nil {
		t.Fatalf("metric tasks completed: %v", err)
	}
	if _, _, err := playerRepo.IncrementMetric(player.MetricZombiesCleared, 3); err != nil {
		t.Fatalf("metric zombies cleared: %v", err)
	}
	if _, _, err := playerRepo.IncrementDeckOpen("deck.first_day"); err != nil {
		t.Fatalf("deck open metric: %v", err)
	}

	h := NewHandler()
	h.SetTaskRepoResolver(func(_ *http.Request) task.Repo { return taskRepo })
	h.SetPlayerResolver(func(_ *http.Request) *player.FileRepo { return playerRepo })

	req := httptest.NewRequest(http.MethodGet, "/api/quests/state", nil)
	rec := httptest.NewRecorder()
	h.State(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var out StateResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(out.Daily) == 0 || len(out.Weekly) == 0 {
		t.Fatalf("expected daily and weekly quests")
	}
	if out.YearlyReview.TasksCompleted < 12 {
		t.Fatalf("expected yearly tasks completed >= 12, got %d", out.YearlyReview.TasksCompleted)
	}

	foundDailyCompletion := false
	for _, q := range out.Daily {
		if q.ID == "DQ_CompleteTask" {
			foundDailyCompletion = true
			if q.Progress < 1 || !q.Completed {
				t.Fatalf("expected daily completion quest done, got %+v", q)
			}
		}
	}
	if !foundDailyCompletion {
		t.Fatalf("expected DQ_CompleteTask in daily quest list")
	}
}

func TestState_MethodNotAllowed(t *testing.T) {
	h := NewHandler()
	req := httptest.NewRequest(http.MethodPost, "/api/quests/state", nil)
	rec := httptest.NewRecorder()
	h.State(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rec.Code)
	}
}

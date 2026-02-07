package blueprint

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRoot_CreateAndListBlueprints(t *testing.T) {
	repo, err := NewFileRepo(t.TempDir())
	if err != nil {
		t.Fatalf("new file repo: %v", err)
	}
	repo = repo.ForUser("u-blueprint")
	h := NewHandler(repo)

	body := []byte(`{"title":"Create a new coding project","description":"Repo + Vite + task plan","modifierSlots":["deadline_pin","next_action"],"steps":["Create repo","Run create-vite","Write task.md"]}`)
	req := httptest.NewRequest(http.MethodPost, "/api/blueprints", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.Root(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d body=%s", rec.Code, rec.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, "/api/blueprints", nil)
	rec = httptest.NewRecorder()
	h.Root(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	var out []map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	if len(out) != 1 {
		t.Fatalf("expected 1 blueprint, got %d", len(out))
	}
}

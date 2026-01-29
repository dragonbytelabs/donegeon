package task

import (
	"encoding/json"
	"net/http"
	"strings"

	"donegeon/internal/model"
)

type Handler struct {
	repo Repo
}

func NewHandler(repo Repo) *Handler {
	return &Handler{repo: repo}
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]any{"error": msg})
}

// /api/tasks  (collection)
func (h *Handler) TasksRoot(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		var in struct {
			Title       string   `json:"title"`
			Description string   `json:"description"`
			Project     *string  `json:"project"`
			Tags        []string `json:"tags"`
		}
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeErr(w, 400, "bad json")
			return
		}

		t, err := h.repo.Create(model.Task{
			Title:       in.Title,
			Description: in.Description,
			Project:     in.Project,
			Tags:        in.Tags,
		})
		if err != nil {
			writeErr(w, 500, err.Error())
			return
		}

		writeJSON(w, 201, t)
		return

	default:
		writeErr(w, 405, "method not allowed")
		return
	}
}

// /api/tasks/{id} or /api/tasks/{id}/modifiers
func (h *Handler) TasksSub(w http.ResponseWriter, r *http.Request) {
	// remainder after "/api/tasks/"
	tail := strings.TrimPrefix(r.URL.Path, "/api/tasks/")
	tail = strings.Trim(tail, "/")
	if tail == "" {
		writeErr(w, 404, "not found")
		return
	}

	parts := strings.Split(tail, "/")
	id := parts[0]

	// /api/tasks/{id}
	if len(parts) == 1 {
		switch r.Method {
		case http.MethodGet:
			t, err := h.repo.Get(model.TaskID(id))
			if err == ErrNotFound {
				writeErr(w, 404, "not found")
				return
			}
			if err != nil {
				writeErr(w, 500, err.Error())
				return
			}
			writeJSON(w, 200, t)
			return

		case http.MethodPatch:
			var p Patch
			if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
				writeErr(w, 400, "bad json")
				return
			}

			t, err := h.repo.Update(model.TaskID(id), p)
			if err == ErrNotFound {
				writeErr(w, 404, "not found")
				return
			}
			if err != nil {
				writeErr(w, 500, err.Error())
				return
			}
			writeJSON(w, 200, t)
			return

		default:
			writeErr(w, 405, "method not allowed")
			return
		}
	}

	// /api/tasks/{id}/modifiers
	if len(parts) == 2 && parts[1] == "modifiers" {
		switch r.Method {
		case http.MethodPut:
			var in struct {
				Modifiers []model.TaskModifierSlot `json:"modifiers"`
			}
			if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
				writeErr(w, 400, "bad json")
				return
			}

			t, err := h.repo.SetModifiers(model.TaskID(id), in.Modifiers)
			if err == ErrTooManyMods {
				writeErr(w, 400, err.Error())
				return
			}
			if err == ErrNotFound {
				writeErr(w, 404, "not found")
				return
			}
			if err != nil {
				writeErr(w, 500, err.Error())
				return
			}

			writeJSON(w, 200, t)
			return

		default:
			writeErr(w, 405, "method not allowed")
			return
		}
	}

	writeErr(w, 404, "not found")
}

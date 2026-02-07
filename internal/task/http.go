package task

import (
	"encoding/json"
	"net/http"
	"strings"

	"donegeon/internal/model"
)

type Handler struct {
	repo         Repo
	repoResolver func(*http.Request) Repo
}

func NewHandler(repo Repo) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) SetRepoResolver(fn func(*http.Request) Repo) {
	h.repoResolver = fn
}

func (h *Handler) repoForRequest(r *http.Request) Repo {
	if h.repoResolver != nil {
		if repo := h.repoResolver(r); repo != nil {
			return repo
		}
	}
	return h.repo
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]any{"error": msg})
}

func decodeJSON(r *http.Request, out any) error {
	dec := json.NewDecoder(r.Body)
	// Optional: dec.DisallowUnknownFields()
	return dec.Decode(out)
}

func normalizeProject(p *string) *string {
	if p == nil {
		v := "inbox"
		return &v
	}
	if strings.TrimSpace(*p) == "" {
		v := "inbox"
		return &v
	}
	return p
}

func parseBoolPtr(s string) *bool {
	s = strings.TrimSpace(strings.ToLower(s))
	if s == "" || s == "any" {
		return nil
	}
	if s == "1" || s == "true" || s == "yes" {
		b := true
		return &b
	}
	if s == "0" || s == "false" || s == "no" {
		b := false
		return &b
	}
	return nil
}

// /api/tasks  (collection)
func (h *Handler) TasksRoot(w http.ResponseWriter, r *http.Request) {
	repo := h.repoForRequest(r)

	switch r.Method {
	case http.MethodGet:
		q := r.URL.Query()
		filter := ListFilter{
			Status:  q.Get("status"),
			Project: q.Get("project"),
			Live:    parseBoolPtr(q.Get("live")),
		}
		ts, err := repo.List(filter)
		if err != nil {
			writeErr(w, 500, err.Error())
			return
		}
		writeJSON(w, 200, ts)
		return

	case http.MethodPost:
		var in model.TaskUpsert
		if err := decodeJSON(r, &in); err != nil {
			writeErr(w, 400, "bad json")
			return
		}
		in.Project = normalizeProject(in.Project)

		t, err := repo.Create(model.Task{
			Title:       in.Title,
			Description: in.Description,
			Done:        in.Done,
			Project:     in.Project,
			Tags:        in.Tags,
			Modifiers:   in.Modifiers,
			DueDate:     in.DueDate,
			NextAction:  in.NextAction,
			Recurrence:  in.Recurrence,
		})
		if err != nil {
			if err == ErrTooManyMods {
				writeErr(w, 400, err.Error())
				return
			}
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

// /api/tasks/{id}
func (h *Handler) TasksSub(w http.ResponseWriter, r *http.Request) {
	repo := h.repoForRequest(r)

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
			t, err := repo.Get(model.TaskID(id))
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
			if err := decodeJSON(r, &p); err != nil {
				writeErr(w, 400, "bad json")
				return
			}

			t, err := repo.Update(model.TaskID(id), p)
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

	// /api/tasks/{id}/live
	if len(parts) == 2 && parts[1] == "live" {
		switch r.Method {
		case http.MethodPut:
			var in struct {
				Live *bool `json:"live"`
			}
			if err := decodeJSON(r, &in); err != nil {
				writeErr(w, 400, "bad json")
				return
			}
			if in.Live == nil {
				writeErr(w, 400, `missing field "live"`)
				return
			}

			if err := repo.SetLive(model.TaskID(id), *in.Live); err != nil {
				if err == ErrNotFound {
					writeErr(w, 404, "not found")
					return
				}
				writeErr(w, 500, err.Error())
				return
			}

			t, err := repo.Get(model.TaskID(id))
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

// /api/tasks/live  (batch sync)
func (h *Handler) TasksLive(w http.ResponseWriter, r *http.Request) {
	repo := h.repoForRequest(r)

	switch r.Method {
	case http.MethodPut:
		var in struct {
			TaskIDs []string `json:"taskIds"`
		}
		if err := decodeJSON(r, &in); err != nil {
			writeErr(w, 400, "bad json")
			return
		}

		ids := make([]model.TaskID, 0, len(in.TaskIDs))
		for _, s := range in.TaskIDs {
			s = strings.TrimSpace(s)
			if s == "" {
				continue
			}
			ids = append(ids, model.TaskID(s))
		}

		if err := repo.SyncLive(ids); err != nil {
			writeErr(w, 500, err.Error())
			return
		}

		writeJSON(w, 200, map[string]any{
			"ok":    true,
			"count": len(ids),
		})
		return

	default:
		writeErr(w, 405, "method not allowed")
		return
	}
}

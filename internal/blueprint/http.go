package blueprint

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
	return json.NewDecoder(r.Body).Decode(out)
}

// /api/blueprints
func (h *Handler) Root(w http.ResponseWriter, r *http.Request) {
	repo := h.repoForRequest(r)
	switch r.Method {
	case http.MethodGet:
		items, err := repo.List()
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, items)
		return
	case http.MethodPost:
		var in model.BlueprintUpsert
		if err := decodeJSON(r, &in); err != nil {
			writeErr(w, http.StatusBadRequest, "bad json")
			return
		}
		in.Title = strings.TrimSpace(in.Title)
		if in.Title == "" {
			writeErr(w, http.StatusBadRequest, "title is required")
			return
		}
		b := newBlueprintFromUpsert(in)
		out, err := repo.Create(b)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, out)
		return
	default:
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
}

// /api/blueprints/{id}
func (h *Handler) Sub(w http.ResponseWriter, r *http.Request) {
	repo := h.repoForRequest(r)
	path := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/blueprints/"), "/")
	if path == "" {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}

	switch r.Method {
	case http.MethodGet:
		b, err := repo.Get(model.BlueprintID(path))
		if err == ErrNotFound {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, b)
		return
	default:
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
}

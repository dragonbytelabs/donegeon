package task

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"donegeon/internal/config"
	"donegeon/internal/model"
	"donegeon/internal/player"
)

type Handler struct {
	repo           Repo
	repoResolver   func(*http.Request) Repo
	playerResolver func(*http.Request) *player.FileRepo
	cfg            *config.Config
}

func NewHandler(repo Repo) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) SetRepoResolver(fn func(*http.Request) Repo) {
	h.repoResolver = fn
}

func (h *Handler) SetPlayerResolver(fn func(*http.Request) *player.FileRepo) {
	h.playerResolver = fn
}

func (h *Handler) SetConfig(cfg *config.Config) {
	h.cfg = cfg
}

func (h *Handler) repoForRequest(r *http.Request) Repo {
	if h.repoResolver != nil {
		if repo := h.repoResolver(r); repo != nil {
			return repo
		}
	}
	return h.repo
}

func (h *Handler) playerForRequest(r *http.Request) *player.FileRepo {
	if h.playerResolver == nil {
		return nil
	}
	return h.playerResolver(r)
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

func isUnlocked(repo *player.FileRepo, feature string) bool {
	if repo == nil {
		return true
	}
	return repo.IsUnlocked(feature)
}

func denyLockedFeature(w http.ResponseWriter, feature string) {
	writeErr(w, http.StatusForbidden, "feature locked: "+feature)
}

func (h *Handler) completionRequiresAssignedVillager() bool {
	if h.cfg == nil {
		return false
	}
	return h.cfg.Tasks.Processing.CompletionRequiresAssignedVillager
}

func (h *Handler) taskWorkStaminaCost() int {
	if h.cfg == nil {
		return 1
	}
	if h.cfg.Villagers.Actions.WorkTask.StaminaCost <= 0 {
		return 1
	}
	return h.cfg.Villagers.Actions.WorkTask.StaminaCost
}

func (h *Handler) villagerBaseMaxStamina() int {
	if h.cfg == nil {
		return 6
	}
	if h.cfg.Villagers.Defaults.BaseMaxStamina <= 0 {
		return 6
	}
	return h.cfg.Villagers.Defaults.BaseMaxStamina
}

// /api/tasks  (collection)
func (h *Handler) TasksRoot(w http.ResponseWriter, r *http.Request) {
	repo := h.repoForRequest(r)
	playerRepo := h.playerForRequest(r)

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
		if in.DueDate != nil && strings.TrimSpace(*in.DueDate) != "" && !isUnlocked(playerRepo, player.FeatureTaskDueDate) {
			denyLockedFeature(w, player.FeatureTaskDueDate)
			return
		}
		if in.NextAction && !isUnlocked(playerRepo, player.FeatureTaskNextAction) {
			denyLockedFeature(w, player.FeatureTaskNextAction)
			return
		}
		if in.Recurrence != nil && !isUnlocked(playerRepo, player.FeatureTaskRecurrence) {
			denyLockedFeature(w, player.FeatureTaskRecurrence)
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
	playerRepo := h.playerForRequest(r)

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
			if p.DueDate != nil && strings.TrimSpace(*p.DueDate) != "" && !isUnlocked(playerRepo, player.FeatureTaskDueDate) {
				denyLockedFeature(w, player.FeatureTaskDueDate)
				return
			}
			if p.NextAction != nil && *p.NextAction && !isUnlocked(playerRepo, player.FeatureTaskNextAction) {
				denyLockedFeature(w, player.FeatureTaskNextAction)
				return
			}
			if p.Recurrence != nil && !isUnlocked(playerRepo, player.FeatureTaskRecurrence) {
				denyLockedFeature(w, player.FeatureTaskRecurrence)
				return
			}
			if p.Done != nil && *p.Done && h.completionRequiresAssignedVillager() {
				cur, err := repo.Get(model.TaskID(id))
				if err == ErrNotFound {
					writeErr(w, 404, "not found")
					return
				}
				if err != nil {
					writeErr(w, 500, err.Error())
					return
				}
				if cur.AssignedVillagerID == nil || strings.TrimSpace(*cur.AssignedVillagerID) == "" {
					writeErr(w, 400, "task completion requires an assigned villager")
					return
				}
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

	// /api/tasks/{id}/process
	if len(parts) == 2 && parts[1] == "process" {
		switch r.Method {
		case http.MethodPost:
			var in struct {
				MarkDone bool `json:"markDone"`
			}
			if r.Body != nil {
				_ = decodeJSON(r, &in)
			}

			cur, err := repo.Get(model.TaskID(id))
			if err == ErrNotFound {
				writeErr(w, 404, "not found")
				return
			}
			if err != nil {
				writeErr(w, 500, err.Error())
				return
			}
			if h.completionRequiresAssignedVillager() {
				if cur.AssignedVillagerID == nil || strings.TrimSpace(*cur.AssignedVillagerID) == "" {
					writeErr(w, 400, "task processing requires an assigned villager")
					return
				}
			}

			staminaRemaining := -1
			if cur.AssignedVillagerID != nil && strings.TrimSpace(*cur.AssignedVillagerID) != "" {
				if pRepo := h.playerForRequest(r); pRepo != nil {
					cost := h.taskWorkStaminaCost()
					ok, remaining, _, err := pRepo.SpendVillagerStamina(*cur.AssignedVillagerID, cost, h.villagerBaseMaxStamina())
					if err != nil {
						writeErr(w, 500, "could not consume villager stamina")
						return
					}
					if !ok {
						writeErr(w, 400, fmt.Sprintf("villager stamina too low (need %d)", cost))
						return
					}
					staminaRemaining = remaining
				}
			}

			worked := true
			inc := 1
			patch := Patch{
				WorkedToday:         &worked,
				ProcessedCountDelta: &inc,
			}
			if in.MarkDone {
				done := true
				patch.Done = &done
			}

			updated, err := repo.Update(model.TaskID(id), patch)
			if err == ErrNotFound {
				writeErr(w, 404, "not found")
				return
			}
			if err != nil {
				writeErr(w, 500, err.Error())
				return
			}

			writeJSON(w, 200, map[string]any{
				"ok":               true,
				"task":             updated,
				"staminaRemaining": staminaRemaining,
			})
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

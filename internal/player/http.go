package player

import (
	"encoding/json"
	"net/http"
	"net/mail"
	"strings"
)

type Handler struct {
	repoResolver func(*http.Request) *FileRepo
}

func NewHandler() *Handler {
	return &Handler{}
}

func (h *Handler) SetRepoResolver(fn func(*http.Request) *FileRepo) {
	h.repoResolver = fn
}

func (h *Handler) repoForRequest(r *http.Request) *FileRepo {
	if h.repoResolver == nil {
		return nil
	}
	return h.repoResolver(r)
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

// GET /api/player/state
func (h *Handler) State(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	repo := h.repoForRequest(r)
	if repo == nil {
		writeErr(w, http.StatusInternalServerError, "player repository unavailable")
		return
	}
	writeJSON(w, http.StatusOK, repo.BuildStateResponse())
}

// POST /api/player/unlock
func (h *Handler) Unlock(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	repo := h.repoForRequest(r)
	if repo == nil {
		writeErr(w, http.StatusInternalServerError, "player repository unavailable")
		return
	}

	var in struct {
		Feature string `json:"feature"`
	}
	if err := decodeJSON(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	feature := strings.TrimSpace(in.Feature)
	if feature == "" {
		writeErr(w, http.StatusBadRequest, `missing field "feature"`)
		return
	}

	cost, ok := defaultCosts().Unlocks[feature]
	if !ok {
		writeErr(w, http.StatusBadRequest, "unknown unlock feature")
		return
	}

	already, unlocked, state, err := repo.UnlockFeature(feature, cost)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not unlock feature")
		return
	}
	if !already && !unlocked {
		writeJSON(w, http.StatusPaymentRequired, map[string]any{
			"error":  "not enough coin to unlock",
			"state":  StateResponse{Loot: state.Loot, Unlocks: state.Unlocks, Costs: defaultCosts()},
			"ok":     false,
			"reason": "insufficient_funds",
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"already": already,
		"state": StateResponse{
			Loot:    state.Loot,
			Unlocks: state.Unlocks,
			Costs:   defaultCosts(),
		},
	})
}

// GET /api/player/profile
func (h *Handler) Profile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	repo := h.repoForRequest(r)
	if repo == nil {
		writeErr(w, http.StatusInternalServerError, "player repository unavailable")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"profile": repo.GetProfile(),
	})
}

// POST /api/player/onboarding/complete
func (h *Handler) CompleteOnboarding(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	repo := h.repoForRequest(r)
	if repo == nil {
		writeErr(w, http.StatusInternalServerError, "player repository unavailable")
		return
	}

	var in struct {
		DisplayName string `json:"displayName"`
		Avatar      string `json:"avatar"`
		TeamName    string `json:"teamName"`
		TeamAvatar  string `json:"teamAvatar"`
	}
	if err := decodeJSON(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}

	profile, _, err := repo.CompleteOnboarding(in.DisplayName, in.Avatar, in.TeamName, in.TeamAvatar)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not complete onboarding")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"profile": profile,
	})
}

// PATCH/POST /api/player/team
func (h *Handler) Team(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch && r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	repo := h.repoForRequest(r)
	if repo == nil {
		writeErr(w, http.StatusInternalServerError, "player repository unavailable")
		return
	}

	var in struct {
		Name   string `json:"name"`
		Avatar string `json:"avatar"`
	}
	if err := decodeJSON(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}

	profile, _, err := repo.UpdateTeam(in.Name, in.Avatar)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not update team")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"profile": profile,
	})
}

// POST /api/player/team/invite
func (h *Handler) TeamInvite(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	repo := h.repoForRequest(r)
	if repo == nil {
		writeErr(w, http.StatusInternalServerError, "player repository unavailable")
		return
	}

	var in struct {
		Email string `json:"email"`
	}
	if err := decodeJSON(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	email := strings.ToLower(strings.TrimSpace(in.Email))
	if email == "" {
		writeErr(w, http.StatusBadRequest, `missing field "email"`)
		return
	}
	if _, err := mail.ParseAddress(email); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid invite email")
		return
	}

	added, profile, _, err := repo.InviteTeamMember(email)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not invite member")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"added":   added,
		"profile": profile,
	})
}

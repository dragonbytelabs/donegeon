package plugin

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"donegeon/internal/model"
	"donegeon/internal/player"
)

type Handler struct {
	repo           Repo
	repoResolver   func(*http.Request) Repo
	playerResolver func(*http.Request) *player.FileRepo
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
	return json.NewDecoder(r.Body).Decode(out)
}

type installStateResponse struct {
	Marketplace []model.PluginMarketplaceItem `json:"marketplace"`
	Installed   []model.InstalledPluginDetail `json:"installed"`
}

func (h *Handler) buildState(repo Repo) (installStateResponse, error) {
	marketplace, err := repo.ListMarketplace()
	if err != nil {
		return installStateResponse{}, err
	}
	installed, err := repo.ListInstalled()
	if err != nil {
		return installStateResponse{}, err
	}

	installedSet := map[model.PluginID]model.InstalledPlugin{}
	for _, in := range installed {
		installedSet[in.PluginID] = in
	}

	items := make([]model.PluginMarketplaceItem, 0, len(marketplace))
	for _, m := range marketplace {
		_, ok := installedSet[m.ID]
		items = append(items, model.PluginMarketplaceItem{
			PluginManifest: m,
			Installed:      ok,
		})
	}

	details := make([]model.InstalledPluginDetail, 0, len(installed))
	for _, in := range installed {
		manifest, err := repo.GetMarketplace(in.PluginID)
		if err != nil {
			continue
		}
		details = append(details, model.InstalledPluginDetail{
			PluginManifest: manifest,
			InstalledAt:    in.InstalledAt,
			Enabled:        in.Enabled,
		})
	}

	return installStateResponse{
		Marketplace: items,
		Installed:   details,
	}, nil
}

func parseManifestFromBody(body []byte) (model.PluginManifest, error) {
	var wrap struct {
		Manifest *model.PluginManifest `json:"manifest"`
	}
	if err := json.Unmarshal(body, &wrap); err != nil {
		return model.PluginManifest{}, err
	}
	if wrap.Manifest != nil {
		return *wrap.Manifest, nil
	}

	var manifest model.PluginManifest
	if err := json.Unmarshal(body, &manifest); err != nil {
		return model.PluginManifest{}, err
	}
	return manifest, nil
}

// /api/plugins/marketplace
func (h *Handler) Marketplace(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	repo := h.repoForRequest(r)
	state, err := h.buildState(repo)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, state)
}

// /api/plugins/register
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	repo := h.repoForRequest(r)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	manifest, err := parseManifestFromBody(body)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}

	created, err := repo.Register(manifest)
	if err != nil {
		switch {
		case errors.Is(err, ErrPluginMissingID), errors.Is(err, ErrPluginMissingName), errors.Is(err, ErrPluginMissingCardDef), errors.Is(err, ErrPluginInvalid):
			writeErr(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, ErrPluginIDConflict):
			writeErr(w, http.StatusConflict, err.Error())
		default:
			writeErr(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

// /api/plugins/install
func (h *Handler) Install(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	repo := h.repoForRequest(r)
	playerRepo := h.playerForRequest(r)

	var in struct {
		PluginID string `json:"pluginId"`
	}
	if err := decodeJSON(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	id := model.PluginID(strings.TrimSpace(in.PluginID))
	if id == "" {
		writeErr(w, http.StatusBadRequest, "missing field \"pluginId\"")
		return
	}

	alreadyInstalled, err := repo.IsInstalled(id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	manifest, err := repo.GetMarketplace(id)
	if err != nil {
		if errors.Is(err, ErrPluginNotFound) {
			writeErr(w, http.StatusNotFound, "plugin not found")
			return
		}
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	coinCost := manifest.InstallCost
	coinsCharged := 0
	if !alreadyInstalled && coinCost > 0 && playerRepo != nil {
		ok, _, err := playerRepo.SpendLoot(player.LootCoin, coinCost)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "failed to spend coin")
			return
		}
		if !ok {
			writeJSON(w, http.StatusPaymentRequired, map[string]any{
				"ok":     false,
				"error":  "not enough coin to install plugin",
				"need":   coinCost,
				"plugin": manifest,
			})
			return
		}
		coinsCharged = coinCost
	}

	already, install, installedManifest, err := repo.Install(id)
	if err != nil {
		if coinsCharged > 0 && playerRepo != nil {
			_, _ = playerRepo.AddLoot(player.LootCoin, coinsCharged)
		}
		if errors.Is(err, ErrPluginNotFound) {
			writeErr(w, http.StatusNotFound, "plugin not found")
			return
		}
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	state, err := h.buildState(repo)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	coinBalance := 0
	if playerRepo != nil {
		coinBalance = playerRepo.GetState().Loot[player.LootCoin]
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":           true,
		"already":      already,
		"coinsCharged": coinsCharged,
		"coinBalance":  coinBalance,
		"installed": map[string]any{
			"plugin":      installedManifest,
			"installedAt": install.InstalledAt,
			"enabled":     install.Enabled,
		},
		"state": state,
	})
}

// /api/plugins/uninstall
func (h *Handler) Uninstall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	repo := h.repoForRequest(r)

	var in struct {
		PluginID string `json:"pluginId"`
	}
	if err := decodeJSON(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	id := model.PluginID(strings.TrimSpace(in.PluginID))
	if id == "" {
		writeErr(w, http.StatusBadRequest, "missing field \"pluginId\"")
		return
	}

	removed, err := repo.Uninstall(id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	state, err := h.buildState(repo)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"removed": removed,
		"state":   state,
	})
}

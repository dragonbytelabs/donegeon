package plugin

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"donegeon/internal/player"
)

func TestMarketplaceIncludesCorePlugins(t *testing.T) {
	repo, err := NewFileRepo(t.TempDir())
	if err != nil {
		t.Fatalf("new plugin repo: %v", err)
	}
	h := NewHandler(repo.ForUser("u-plugin"))

	req := httptest.NewRequest(http.MethodGet, "/api/plugins/marketplace", nil)
	rec := httptest.NewRecorder()
	h.Marketplace(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("marketplace expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	var out map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatalf("decode marketplace: %v", err)
	}
	rows, _ := out["marketplace"].([]any)
	if len(rows) < 4 {
		t.Fatalf("expected core marketplace rows, got %d", len(rows))
	}
}

func TestRegisterInstallUninstallPlugin(t *testing.T) {
	repo, err := NewFileRepo(t.TempDir())
	if err != nil {
		t.Fatalf("new plugin repo: %v", err)
	}
	pluginRepo := repo.ForUser("u-plugin")

	playerRepo, err := player.NewFileRepo(t.TempDir())
	if err != nil {
		t.Fatalf("new player repo: %v", err)
	}
	playerRepo = playerRepo.ForUser("u-plugin")
	if _, err := playerRepo.AddLoot(player.LootCoin, 20); err != nil {
		t.Fatalf("seed coin: %v", err)
	}

	h := NewHandler(pluginRepo)
	h.SetPlayerResolver(func(_ *http.Request) *player.FileRepo { return playerRepo })

	registerBody := map[string]any{
		"manifest": map[string]any{
			"id":          "jira_workflow_plus",
			"name":        "Jira Workflow Plus",
			"description": "Community Jira shortcuts",
			"provider":    "Community",
			"category":    "work",
			"cardDefId":   "mod.plugin_jira_workflow_plus",
			"cardTitle":   "Jira Workflow",
			"cardIcon":    "🧩",
			"installCost": 3,
		},
	}
	req := jsonReq(http.MethodPost, "/api/plugins/register", registerBody)
	rec := httptest.NewRecorder()
	h.Register(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("register expected 201, got %d body=%s", rec.Code, rec.Body.String())
	}

	installReq := jsonReq(http.MethodPost, "/api/plugins/install", map[string]any{"pluginId": "jira_workflow_plus"})
	installRec := httptest.NewRecorder()
	h.Install(installRec, installReq)
	if installRec.Code != http.StatusOK {
		t.Fatalf("install expected 200, got %d body=%s", installRec.Code, installRec.Body.String())
	}

	var installOut map[string]any
	if err := json.NewDecoder(installRec.Body).Decode(&installOut); err != nil {
		t.Fatalf("decode install: %v", err)
	}
	charged, _ := installOut["coinsCharged"].(float64)
	if int(charged) != 3 {
		t.Fatalf("expected coins charged 3, got %v", installOut["coinsCharged"])
	}
	if got := playerRepo.GetState().Loot[player.LootCoin]; got != 17 {
		t.Fatalf("expected remaining coin 17, got %d", got)
	}

	uninstallReq := jsonReq(http.MethodPost, "/api/plugins/uninstall", map[string]any{"pluginId": "jira_workflow_plus"})
	uninstallRec := httptest.NewRecorder()
	h.Uninstall(uninstallRec, uninstallReq)
	if uninstallRec.Code != http.StatusOK {
		t.Fatalf("uninstall expected 200, got %d body=%s", uninstallRec.Code, uninstallRec.Body.String())
	}
}

func TestInstallPluginInsufficientCoins(t *testing.T) {
	repo, err := NewFileRepo(t.TempDir())
	if err != nil {
		t.Fatalf("new plugin repo: %v", err)
	}
	pluginRepo := repo.ForUser("u-low-coin")

	playerRepo, err := player.NewFileRepo(t.TempDir())
	if err != nil {
		t.Fatalf("new player repo: %v", err)
	}
	playerRepo = playerRepo.ForUser("u-low-coin")

	h := NewHandler(pluginRepo)
	h.SetPlayerResolver(func(_ *http.Request) *player.FileRepo { return playerRepo })

	req := jsonReq(http.MethodPost, "/api/plugins/install", map[string]any{"pluginId": "zapier"})
	rec := httptest.NewRecorder()
	h.Install(rec, req)
	if rec.Code != http.StatusPaymentRequired {
		t.Fatalf("install expected 402, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func jsonReq(method, path string, body any) *http.Request {
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(method, path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	return req
}

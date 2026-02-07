package main

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"testing"

	"donegeon/internal/config"
	"donegeon/internal/serverapp"
)

func TestServer_ProtectedRoutesRequireAuth(t *testing.T) {
	app := newTestApp(t)

	apiRes := app.request(http.MethodGet, "/api/tasks", nil, "")
	if apiRes.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for /api/tasks, got %d", apiRes.Code)
	}

	pageRes := app.request(http.MethodGet, "/tasks", nil, "")
	if pageRes.Code != http.StatusSeeOther {
		t.Fatalf("expected 303 for /tasks, got %d", pageRes.Code)
	}
	if loc := pageRes.Header().Get("Location"); loc != "/login" {
		t.Fatalf("expected redirect to /login, got %q", loc)
	}
	onboardingRes := app.request(http.MethodGet, "/onboarding", nil, "")
	if onboardingRes.Code != http.StatusSeeOther {
		t.Fatalf("expected 303 for /onboarding, got %d", onboardingRes.Code)
	}
	if loc := onboardingRes.Header().Get("Location"); loc != "/login" {
		t.Fatalf("expected /onboarding redirect to /login, got %q", loc)
	}
}

func TestServer_OTPFlowAndEmbeddedStatic(t *testing.T) {
	app := newTestApp(t)
	const email = "integration@example.com"

	res := app.json(http.MethodPost, "/api/auth/request-otp", map[string]any{
		"email": email,
	})
	if res.Code != http.StatusOK {
		t.Fatalf("request otp expected 200, got %d body=%s", res.Code, res.Body.String())
	}

	code := otpCodeFromLogs(t, app.logs)
	verifyRes := app.json(http.MethodPost, "/api/auth/verify-otp", map[string]any{
		"email": email,
		"code":  code,
	})
	if verifyRes.Code != http.StatusOK {
		t.Fatalf("verify otp expected 200, got %d body=%s", verifyRes.Code, verifyRes.Body.String())
	}

	sessionRes := app.request(http.MethodGet, "/api/auth/session", nil, "")
	if sessionRes.Code != http.StatusOK {
		t.Fatalf("session expected 200, got %d body=%s", sessionRes.Code, sessionRes.Body.String())
	}

	tasksRes := app.request(http.MethodGet, "/api/tasks", nil, "")
	if tasksRes.Code != http.StatusOK {
		t.Fatalf("tasks expected 200, got %d body=%s", tasksRes.Code, tasksRes.Body.String())
	}
	pluginRes := app.request(http.MethodGet, "/api/plugins/marketplace", nil, "")
	if pluginRes.Code != http.StatusOK {
		t.Fatalf("plugin marketplace expected 200, got %d body=%s", pluginRes.Code, pluginRes.Body.String())
	}

	appRes := app.request(http.MethodGet, "/app", nil, "")
	if appRes.Code != http.StatusSeeOther {
		t.Fatalf("app route expected 303, got %d", appRes.Code)
	}
	if loc := appRes.Header().Get("Location"); loc != "/onboarding" {
		t.Fatalf("app route expected redirect to /onboarding, got %q", loc)
	}

	pageRes := app.request(http.MethodGet, "/tasks", nil, "")
	if pageRes.Code != http.StatusSeeOther {
		t.Fatalf("tasks page expected 303 before onboarding, got %d", pageRes.Code)
	}
	if loc := pageRes.Header().Get("Location"); loc != "/onboarding" {
		t.Fatalf("tasks page expected redirect to /onboarding, got %q", loc)
	}

	onboardingRes := app.request(http.MethodGet, "/onboarding", nil, "")
	if onboardingRes.Code != http.StatusOK {
		t.Fatalf("onboarding page expected 200, got %d", onboardingRes.Code)
	}

	completeRes := app.json(http.MethodPost, "/api/player/onboarding/complete", map[string]any{
		"displayName": "Integration User",
		"teamName":    "Integration Team",
	})
	if completeRes.Code != http.StatusOK {
		t.Fatalf("onboarding complete expected 200, got %d body=%s", completeRes.Code, completeRes.Body.String())
	}

	appRes = app.request(http.MethodGet, "/app", nil, "")
	if appRes.Code != http.StatusSeeOther {
		t.Fatalf("app route expected 303 after onboarding, got %d", appRes.Code)
	}
	if loc := appRes.Header().Get("Location"); loc != "/tasks" {
		t.Fatalf("app route expected redirect to /tasks after onboarding, got %q", loc)
	}

	pageRes = app.request(http.MethodGet, "/tasks", nil, "")
	if pageRes.Code != http.StatusOK {
		t.Fatalf("tasks page expected 200 after onboarding, got %d", pageRes.Code)
	}
	builderRes := app.request(http.MethodGet, "/builder", nil, "")
	if builderRes.Code != http.StatusFound {
		t.Fatalf("builder route expected 302, got %d", builderRes.Code)
	}
	if loc := builderRes.Header().Get("Location"); loc != "/tasks#blueprints" {
		t.Fatalf("builder route expected redirect to /tasks#blueprints, got %q", loc)
	}

	staticRes := app.request(http.MethodGet, "/static/js/login.js", nil, "")
	if staticRes.Code != http.StatusOK {
		t.Fatalf("embedded static asset expected 200, got %d", staticRes.Code)
	}
	if staticRes.Body.Len() == 0 {
		t.Fatalf("embedded static asset should not be empty")
	}
}

func TestServer_HealthAndReadinessExposeRequestID(t *testing.T) {
	app := newTestApp(t)

	for _, path := range []string{"/healthz", "/readyz"} {
		res := app.request(http.MethodGet, path, nil, "")
		if res.Code != http.StatusOK {
			t.Fatalf("%s expected 200, got %d body=%s", path, res.Code, res.Body.String())
		}
		if rid := strings.TrimSpace(res.Header().Get("X-Request-Id")); rid == "" {
			t.Fatalf("%s missing X-Request-Id header", path)
		}
	}
}

func TestServer_BoardTaskRoundTripAndCalendarExport(t *testing.T) {
	app := newTestApp(t)
	app.loginAndOnboard(t, "roundtrip@example.com")

	seedRes := app.json(http.MethodPost, "/api/board/cmd", map[string]any{
		"cmd":  "board.seed_default",
		"args": map[string]any{"deckRowY": 560},
	})
	if seedRes.Code != http.StatusOK {
		t.Fatalf("board seed expected 200, got %d body=%s", seedRes.Code, seedRes.Body.String())
	}

	createRes := app.json(http.MethodPost, "/api/board/cmd", map[string]any{
		"cmd":  "task.create_blank",
		"args": map[string]any{"x": 320, "y": 260},
	})
	if createRes.Code != http.StatusOK {
		t.Fatalf("task.create_blank expected 200, got %d body=%s", createRes.Code, createRes.Body.String())
	}
	createBody := decodeBodyMap(t, createRes)
	patch := asMap(t, createBody["patch"])
	taskID := asString(t, patch["taskId"])
	taskCardID := asString(t, asMap(t, patch["card"])["id"])
	taskStackID := asString(t, asMap(t, patch["stack"])["id"])

	for cmd, args := range map[string]map[string]any{
		"task.set_title": {
			"taskCardId": taskCardID,
			"title":      "Roundtrip task",
		},
		"task.set_description": {
			"taskCardId":  taskCardID,
			"description": "Created on board and verified in tasks",
		},
	} {
		res := app.json(http.MethodPost, "/api/board/cmd", map[string]any{"cmd": cmd, "args": args})
		if res.Code != http.StatusOK {
			t.Fatalf("%s expected 200, got %d body=%s", cmd, res.Code, res.Body.String())
		}
	}

	tasksRes := app.request(http.MethodGet, "/api/tasks?live=true", nil, "")
	if tasksRes.Code != http.StatusOK {
		t.Fatalf("list live tasks expected 200, got %d body=%s", tasksRes.Code, tasksRes.Body.String())
	}
	if !strings.Contains(tasksRes.Body.String(), taskID) {
		t.Fatalf("expected live tasks response to include created task id %s, body=%s", taskID, tasksRes.Body.String())
	}

	dueDate := "2026-02-12"
	patchRes := app.json(http.MethodPatch, "/api/tasks/"+taskID, map[string]any{
		"dueDate": dueDate,
		"recurrence": map[string]any{
			"type":     "weekly",
			"interval": 1,
		},
		"modifiers": []map[string]any{
			{"defId": "mod.deadline_pin"},
			{"defId": "mod.recurring"},
		},
	})
	if patchRes.Code != http.StatusOK {
		t.Fatalf("task patch expected 200, got %d body=%s", patchRes.Code, patchRes.Body.String())
	}

	icsRes := app.request(http.MethodGet, "/api/tasks/"+taskID+"/calendar.ics", nil, "")
	if icsRes.Code != http.StatusOK {
		t.Fatalf("calendar export expected 200, got %d body=%s", icsRes.Code, icsRes.Body.String())
	}
	icsBody := icsRes.Body.String()
	for _, want := range []string{
		"BEGIN:VCALENDAR",
		"SUMMARY:Roundtrip task",
		"DTSTART;VALUE=DATE:20260212",
		"RRULE:FREQ=WEEKLY;INTERVAL=1",
		"END:VCALENDAR",
	} {
		if !strings.Contains(icsBody, want) {
			t.Fatalf("calendar export missing %q body=%s", want, icsBody)
		}
	}

	boardStateRes := app.request(http.MethodGet, "/api/board/state", nil, "")
	if boardStateRes.Code != http.StatusOK {
		t.Fatalf("board state expected 200, got %d body=%s", boardStateRes.Code, boardStateRes.Body.String())
	}
	state := decodeBoardState(t, boardStateRes)
	villagerStackID := findStackIDByKind(state, "villager")
	if villagerStackID == "" {
		t.Fatalf("expected a villager stack in seeded board state")
	}

	assignRes := app.json(http.MethodPost, "/api/board/cmd", map[string]any{
		"cmd": "task.assign_villager",
		"args": map[string]any{
			"taskStackId":     taskStackID,
			"villagerStackId": villagerStackID,
		},
	})
	if assignRes.Code != http.StatusOK {
		t.Fatalf("task.assign_villager expected 200, got %d body=%s", assignRes.Code, assignRes.Body.String())
	}

	completeRes := app.json(http.MethodPost, "/api/board/cmd", map[string]any{
		"cmd":  "task.complete_by_task_id",
		"args": map[string]any{"taskId": taskID},
	})
	if completeRes.Code != http.StatusOK {
		t.Fatalf("task.complete_by_task_id expected 200, got %d body=%s", completeRes.Code, completeRes.Body.String())
	}

	taskRes := app.request(http.MethodGet, "/api/tasks/"+taskID, nil, "")
	if taskRes.Code != http.StatusOK {
		t.Fatalf("task get expected 200, got %d body=%s", taskRes.Code, taskRes.Body.String())
	}
	taskBody := decodeBodyMap(t, taskRes)
	done, _ := taskBody["done"].(bool)
	if !done {
		t.Fatalf("expected task to be done after completion, body=%s", taskRes.Body.String())
	}

	boardStateRes = app.request(http.MethodGet, "/api/board/state", nil, "")
	if boardStateRes.Code != http.StatusOK {
		t.Fatalf("board state expected 200 after completion, got %d body=%s", boardStateRes.Code, boardStateRes.Body.String())
	}
	state = decodeBoardState(t, boardStateRes)
	if boardContainsTaskID(state, taskID) {
		t.Fatalf("expected completed task %s to be removed from board state", taskID)
	}
}

type testApp struct {
	handler http.Handler
	logs    *bytes.Buffer
	cookies map[string]*http.Cookie
}

func newTestApp(t *testing.T) *testApp {
	t.Helper()

	cfg := loadTestConfig(t)
	dataDir := t.TempDir()

	var logs bytes.Buffer
	logger := log.New(&logs, "", 0)

	h, err := serverapp.NewHandler(serverapp.Options{
		Config:        cfg,
		DataDir:       dataDir,
		StaticDir:     filepath.Join(projectRoot(t), "static"),
		UseDiskStatic: false,
		Logger:        logger,
	})
	if err != nil {
		t.Fatalf("NewServerHandler: %v", err)
	}

	return &testApp{
		handler: h,
		logs:    &logs,
		cookies: map[string]*http.Cookie{},
	}
}

func (a *testApp) json(method, path string, body any) *httptest.ResponseRecorder {
	b, _ := json.Marshal(body)
	return a.request(method, path, bytes.NewReader(b), "application/json")
}

func (a *testApp) request(method, path string, body io.Reader, contentType string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, body)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	for _, c := range a.cookies {
		req.AddCookie(c)
	}

	rec := httptest.NewRecorder()
	a.handler.ServeHTTP(rec, req)
	a.captureCookies(rec.Result())
	return rec
}

func (a *testApp) captureCookies(res *http.Response) {
	for _, c := range res.Cookies() {
		if c == nil {
			continue
		}
		if c.MaxAge < 0 || strings.TrimSpace(c.Value) == "" {
			delete(a.cookies, c.Name)
			continue
		}
		cp := *c
		a.cookies[c.Name] = &cp
	}
}

func loadTestConfig(t *testing.T) *config.Config {
	t.Helper()
	cfgPath := filepath.Join(projectRoot(t), "donegeon_config.yml")
	cfg, err := config.Load(cfgPath)
	if err != nil {
		t.Fatalf("load config %s: %v", cfgPath, err)
	}
	return cfg
}

func projectRoot(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatalf("runtime.Caller failed")
	}
	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", ".."))
}

func otpCodeFromLogs(t *testing.T, logs *bytes.Buffer) string {
	t.Helper()
	re := regexp.MustCompile(`OTP code for .* is ([0-9]{6})`)
	matches := re.FindAllStringSubmatch(logs.String(), -1)
	if len(matches) == 0 {
		t.Fatalf("no OTP code found in logs: %s", logs.String())
	}
	last := matches[len(matches)-1]
	if len(last) < 2 {
		t.Fatalf("malformed OTP log match: %+v", last)
	}
	return last[1]
}

func (a *testApp) loginAndOnboard(t *testing.T, email string) {
	t.Helper()

	res := a.json(http.MethodPost, "/api/auth/request-otp", map[string]any{
		"email": email,
	})
	if res.Code != http.StatusOK {
		t.Fatalf("request otp expected 200, got %d body=%s", res.Code, res.Body.String())
	}

	code := otpCodeFromLogs(t, a.logs)
	verifyRes := a.json(http.MethodPost, "/api/auth/verify-otp", map[string]any{
		"email": email,
		"code":  code,
	})
	if verifyRes.Code != http.StatusOK {
		t.Fatalf("verify otp expected 200, got %d body=%s", verifyRes.Code, verifyRes.Body.String())
	}

	completeRes := a.json(http.MethodPost, "/api/player/onboarding/complete", map[string]any{
		"displayName": "Integration User",
		"teamName":    "Integration Team",
	})
	if completeRes.Code != http.StatusOK {
		t.Fatalf("onboarding complete expected 200, got %d body=%s", completeRes.Code, completeRes.Body.String())
	}
}

type boardStateSnapshot struct {
	Stacks map[string]struct {
		Cards []string `json:"cards"`
	} `json:"stacks"`
	Cards map[string]struct {
		DefID string         `json:"defId"`
		Data  map[string]any `json:"data"`
	} `json:"cards"`
}

func decodeBodyMap(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var out map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode json body failed: %v body=%s", err, rec.Body.String())
	}
	return out
}

func decodeBoardState(t *testing.T, rec *httptest.ResponseRecorder) boardStateSnapshot {
	t.Helper()
	var out boardStateSnapshot
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode board state failed: %v body=%s", err, rec.Body.String())
	}
	return out
}

func asMap(t *testing.T, v any) map[string]any {
	t.Helper()
	out, ok := v.(map[string]any)
	if !ok {
		t.Fatalf("expected map[string]any, got %T (%v)", v, v)
	}
	return out
}

func asString(t *testing.T, v any) string {
	t.Helper()
	s, ok := v.(string)
	if !ok {
		t.Fatalf("expected string, got %T (%v)", v, v)
	}
	return s
}

func findStackIDByKind(state boardStateSnapshot, kind string) string {
	prefix := strings.TrimSpace(kind) + "."
	for stackID, stack := range state.Stacks {
		for _, cid := range stack.Cards {
			card, ok := state.Cards[cid]
			if !ok {
				continue
			}
			if strings.HasPrefix(card.DefID, prefix) {
				return stackID
			}
		}
	}
	return ""
}

func boardContainsTaskID(state boardStateSnapshot, taskID string) bool {
	want := strings.TrimSpace(taskID)
	if want == "" {
		return false
	}
	for _, card := range state.Cards {
		if !strings.HasPrefix(card.DefID, "task.") {
			continue
		}
		v, _ := card.Data["taskId"].(string)
		if strings.TrimSpace(v) == want {
			return true
		}
	}
	return false
}

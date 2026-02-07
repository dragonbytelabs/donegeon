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

	pageRes := app.request(http.MethodGet, "/tasks", nil, "")
	if pageRes.Code != http.StatusOK {
		t.Fatalf("tasks page expected 200, got %d", pageRes.Code)
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

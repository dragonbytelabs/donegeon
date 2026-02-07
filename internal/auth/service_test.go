package auth

import (
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func newAuthServiceForTests(t *testing.T) *Service {
	t.Helper()
	repo, err := NewFileRepo(t.TempDir())
	if err != nil {
		t.Fatalf("new auth repo: %v", err)
	}
	return NewService(repo, log.New(io.Discard, "", 0))
}

func TestService_VerifyOTP_TooManyAttempts(t *testing.T) {
	svc := newAuthServiceForTests(t)
	now := time.Date(2026, 2, 7, 9, 0, 0, 0, time.UTC)

	if _, _, err := svc.RequestOTP("tester@example.com", now); err != nil {
		t.Fatalf("request otp: %v", err)
	}

	for i := 0; i < svc.maxOTPAttempts-1; i++ {
		if _, _, _, err := svc.VerifyOTP("tester@example.com", "000000", now.Add(30*time.Second)); err != ErrInvalidOTP {
			t.Fatalf("attempt %d expected ErrInvalidOTP, got %v", i+1, err)
		}
	}

	if _, _, _, err := svc.VerifyOTP("tester@example.com", "000000", now.Add(45*time.Second)); err != ErrTooManyOTPAttempts {
		t.Fatalf("final attempt expected ErrTooManyOTPAttempts, got %v", err)
	}
}

func TestService_AuthenticateRequest_ExpiredSessionIsRejected(t *testing.T) {
	svc := newAuthServiceForTests(t)
	now := time.Date(2026, 2, 7, 10, 0, 0, 0, time.UTC)

	_, code, err := svc.RequestOTP("expired@example.com", now)
	if err != nil {
		t.Fatalf("request otp: %v", err)
	}
	u, token, exp, err := svc.VerifyOTP("expired@example.com", code, now.Add(time.Minute))
	if err != nil {
		t.Fatalf("verify otp: %v", err)
	}
	if u.Email != "expired@example.com" {
		t.Fatalf("unexpected user: %+v", u)
	}

	req := httptest.NewRequest("GET", "/api/auth/session", nil)
	req.AddCookie(newSessionCookie(svc.cookieName, token))

	if _, _, ok := svc.AuthenticateRequest(req, exp.Add(time.Second)); ok {
		t.Fatalf("expected expired session to be rejected")
	}
	if _, ok := svc.repo.GetSessionByTokenHash(hashToken(token)); ok {
		t.Fatalf("expected expired session to be removed from repo")
	}
}

func TestService_NewService_RespectsSecurityEnv(t *testing.T) {
	t.Setenv("DONEGEON_COOKIE_NAME", "dg_session")
	t.Setenv("DONEGEON_COOKIE_PATH", "/app")
	t.Setenv("DONEGEON_COOKIE_DOMAIN", "example.com")
	t.Setenv("DONEGEON_COOKIE_SAMESITE", "strict")
	t.Setenv("DONEGEON_SESSION_TTL_HOURS", "24")
	t.Setenv("DONEGEON_OTP_TTL_MINUTES", "5")
	t.Setenv("DONEGEON_OTP_MAX_ATTEMPTS", "3")

	svc := newAuthServiceForTests(t)
	if svc.cookieName != "dg_session" {
		t.Fatalf("expected cookie name override, got %q", svc.cookieName)
	}
	if svc.cookiePath != "/app" {
		t.Fatalf("expected cookie path override, got %q", svc.cookiePath)
	}
	if svc.cookieDomain != "example.com" {
		t.Fatalf("expected cookie domain override, got %q", svc.cookieDomain)
	}
	if svc.cookieSameSite != http.SameSiteStrictMode {
		t.Fatalf("expected strict same-site, got %v", svc.cookieSameSite)
	}
	if svc.sessionTTL != 24*time.Hour {
		t.Fatalf("expected 24h session ttl, got %s", svc.sessionTTL)
	}
	if svc.otpTTL != 5*time.Minute {
		t.Fatalf("expected 5m otp ttl, got %s", svc.otpTTL)
	}
	if svc.maxOTPAttempts != 3 {
		t.Fatalf("expected 3 max otp attempts, got %d", svc.maxOTPAttempts)
	}
}

func TestService_SetSessionCookie_DowngradesSameSiteNoneWithoutSecure(t *testing.T) {
	t.Setenv("DONEGEON_COOKIE_SAMESITE", "none")
	t.Setenv("DONEGEON_COOKIE_SECURE", "false")
	t.Setenv("DONEGEON_COOKIE_DOMAIN", "example.com")

	svc := newAuthServiceForTests(t)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "http://localhost/login", nil)
	exp := time.Now().Add(1 * time.Hour)
	svc.SetSessionCookie(w, req, "token-123", exp)

	res := w.Result()
	cookies := res.Cookies()
	if len(cookies) != 1 {
		t.Fatalf("expected one cookie set, got %d", len(cookies))
	}
	c := cookies[0]
	if c.SameSite != http.SameSiteLaxMode {
		t.Fatalf("expected SameSite downgrade to Lax for non-secure requests, got %v", c.SameSite)
	}
	if c.Secure {
		t.Fatalf("expected non-secure cookie for forced DONEGEON_COOKIE_SECURE=false")
	}
	if c.Domain != "example.com" {
		t.Fatalf("expected cookie domain to be applied, got %q", c.Domain)
	}
}

func newSessionCookie(name, value string) *http.Cookie {
	return &http.Cookie{Name: name, Value: value}
}

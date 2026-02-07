package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"net/mail"
	"os"
	"strings"
	"time"
)

var (
	ErrInvalidEmail       = errors.New("invalid email")
	ErrInvalidOTPFormat   = errors.New("otp code must be 6 digits")
	ErrInvalidOTP         = errors.New("invalid otp code")
	ErrOTPExpired         = errors.New("otp code expired")
	ErrTooManyOTPAttempts = errors.New("too many invalid otp attempts")
)

type Service struct {
	repo *FileRepo

	logger *log.Logger

	cookieName     string
	otpTTL         time.Duration
	sessionTTL     time.Duration
	maxOTPAttempts int
}

func NewService(repo *FileRepo, logger *log.Logger) *Service {
	if logger == nil {
		logger = log.Default()
	}
	return &Service{
		repo:           repo,
		logger:         logger,
		cookieName:     "donegeon_session",
		otpTTL:         10 * time.Minute,
		sessionTTL:     7 * 24 * time.Hour,
		maxOTPAttempts: 5,
	}
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func validateEmail(email string) error {
	if email == "" {
		return ErrInvalidEmail
	}
	addr, err := mail.ParseAddress(email)
	if err != nil {
		return ErrInvalidEmail
	}
	if strings.ToLower(addr.Address) != email {
		return ErrInvalidEmail
	}
	return nil
}

func validateCode(code string) error {
	if len(code) != 6 {
		return ErrInvalidOTPFormat
	}
	for _, ch := range code {
		if ch < '0' || ch > '9' {
			return ErrInvalidOTPFormat
		}
	}
	return nil
}

func hashOTP(email, code string) string {
	sum := sha256.Sum256([]byte(email + ":" + code))
	return hex.EncodeToString(sum[:])
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func generateOTPCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func generateToken() (string, error) {
	var b [32]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b[:]), nil
}

func (s *Service) RequestOTP(email string, now time.Time) (expiresAt time.Time, code string, err error) {
	email = normalizeEmail(email)
	if err := validateEmail(email); err != nil {
		return time.Time{}, "", err
	}
	code, err = generateOTPCode()
	if err != nil {
		return time.Time{}, "", err
	}
	ch := OTPChallenge{
		Email:       email,
		CodeHash:    hashOTP(email, code),
		ExpiresAt:   now.Add(s.otpTTL),
		RequestedAt: now,
		Attempts:    0,
	}
	if err := s.repo.PutChallenge(ch); err != nil {
		return time.Time{}, "", err
	}
	return ch.ExpiresAt, code, nil
}

func (s *Service) VerifyOTP(email, otpCode string, now time.Time) (User, string, time.Time, error) {
	email = normalizeEmail(email)
	if err := validateEmail(email); err != nil {
		return User{}, "", time.Time{}, err
	}
	if err := validateCode(otpCode); err != nil {
		return User{}, "", time.Time{}, err
	}

	ch, ok := s.repo.GetChallenge(email)
	if !ok {
		return User{}, "", time.Time{}, ErrInvalidOTP
	}

	if now.After(ch.ExpiresAt) {
		_ = s.repo.DeleteChallenge(email)
		return User{}, "", time.Time{}, ErrOTPExpired
	}

	if ch.Attempts >= s.maxOTPAttempts {
		_ = s.repo.DeleteChallenge(email)
		return User{}, "", time.Time{}, ErrTooManyOTPAttempts
	}

	if hashOTP(email, otpCode) != ch.CodeHash {
		ch.Attempts++
		if ch.Attempts >= s.maxOTPAttempts {
			_ = s.repo.DeleteChallenge(email)
			return User{}, "", time.Time{}, ErrTooManyOTPAttempts
		}
		_ = s.repo.PutChallenge(ch)
		return User{}, "", time.Time{}, ErrInvalidOTP
	}

	if err := s.repo.DeleteChallenge(email); err != nil {
		return User{}, "", time.Time{}, err
	}

	u, _, err := s.repo.GetOrCreateUser(email, now)
	if err != nil {
		return User{}, "", time.Time{}, err
	}

	token, err := generateToken()
	if err != nil {
		return User{}, "", time.Time{}, err
	}

	exp := now.Add(s.sessionTTL)
	sess := Session{
		ID:        newID("sess"),
		UserID:    u.ID,
		TokenHash: hashToken(token),
		CreatedAt: now,
		LastSeen:  now,
		ExpiresAt: exp,
	}
	if err := s.repo.CreateSession(sess); err != nil {
		return User{}, "", time.Time{}, err
	}
	return u, token, exp, nil
}

func (s *Service) AuthenticateRequest(r *http.Request, now time.Time) (User, Session, bool) {
	cookie, err := r.Cookie(s.cookieName)
	if err != nil || cookie.Value == "" {
		return User{}, Session{}, false
	}

	sess, ok := s.repo.GetSessionByTokenHash(hashToken(cookie.Value))
	if !ok {
		return User{}, Session{}, false
	}

	if now.After(sess.ExpiresAt) {
		_ = s.repo.DeleteSessionByID(sess.ID)
		return User{}, Session{}, false
	}

	u, ok := s.repo.GetUserByID(sess.UserID)
	if !ok {
		_ = s.repo.DeleteSessionByID(sess.ID)
		return User{}, Session{}, false
	}

	// Best-effort last-seen update, throttled to reduce writes.
	if now.Sub(sess.LastSeen) >= 5*time.Minute {
		_ = s.repo.TouchSession(sess.ID, now)
		sess.LastSeen = now
	}

	return u, sess, true
}

func (s *Service) RevokeSessionForRequest(r *http.Request) {
	cookie, err := r.Cookie(s.cookieName)
	if err != nil || cookie.Value == "" {
		return
	}
	_ = s.repo.DeleteSessionByTokenHash(hashToken(cookie.Value))
}

func (s *Service) shouldUseSecureCookie(r *http.Request) bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("DONEGEON_COOKIE_SECURE"))) {
	case "1", "true", "yes":
		return true
	case "0", "false", "no":
		return false
	}
	if r.TLS != nil {
		return true
	}
	return strings.EqualFold(strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")), "https")
}

func (s *Service) SetSessionCookie(w http.ResponseWriter, r *http.Request, token string, expiresAt time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     s.cookieName,
		Value:    token,
		Path:     "/",
		Expires:  expiresAt,
		HttpOnly: true,
		Secure:   s.shouldUseSecureCookie(r),
		SameSite: http.SameSiteLaxMode,
	})
}

func (s *Service) ClearSessionCookie(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     s.cookieName,
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   s.shouldUseSecureCookie(r),
		SameSite: http.SameSiteLaxMode,
	})
}

func (s *Service) RequirePage(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, sess, ok := s.AuthenticateRequest(r, time.Now())
		if !ok {
			http.Redirect(w, r, "/login", http.StatusSeeOther)
			return
		}
		ctx := withSessionContext(withUserContext(r.Context(), u), sess)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (s *Service) RequireAPI(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, sess, ok := s.AuthenticateRequest(r, time.Now())
		if !ok {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]any{"error": "unauthorized"})
			return
		}
		ctx := withSessionContext(withUserContext(r.Context(), u), sess)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (s *Service) HandleAppRoute(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := s.AuthenticateRequest(r, time.Now()); ok {
		http.Redirect(w, r, "/tasks", http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/login", http.StatusSeeOther)
}

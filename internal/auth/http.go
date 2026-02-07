package auth

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
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

// POST /api/auth/request-otp
func (h *Handler) RequestOTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var in struct {
		Email string `json:"email"`
	}
	if err := decodeJSON(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}

	exp, code, err := h.service.RequestOTP(in.Email, time.Now())
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidEmail):
			writeErr(w, http.StatusBadRequest, err.Error())
		default:
			writeErr(w, http.StatusInternalServerError, "could not request otp")
		}
		return
	}

	h.service.logger.Printf("[auth] OTP code for %s is %s (expires %s)", in.Email, code, exp.Format(time.RFC3339))

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"expiresAt": exp.Format(time.RFC3339),
	})
}

// POST /api/auth/verify-otp
func (h *Handler) VerifyOTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var in struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}
	if err := decodeJSON(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}

	u, token, exp, err := h.service.VerifyOTP(in.Email, in.Code, time.Now())
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidEmail), errors.Is(err, ErrInvalidOTPFormat):
			writeErr(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, ErrInvalidOTP), errors.Is(err, ErrOTPExpired):
			writeErr(w, http.StatusUnauthorized, err.Error())
		case errors.Is(err, ErrTooManyOTPAttempts):
			writeErr(w, http.StatusTooManyRequests, err.Error())
		default:
			writeErr(w, http.StatusInternalServerError, "could not verify otp")
		}
		return
	}

	h.service.SetSessionCookie(w, r, token, exp)

	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"user": map[string]any{
			"id":    u.ID,
			"email": u.Email,
		},
		"expiresAt": exp.Format(time.RFC3339),
	})
}

// GET /api/auth/session
func (h *Handler) Session(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	u, sess, ok := h.service.AuthenticateRequest(r, time.Now())
	if !ok {
		writeErr(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"user": map[string]any{
			"id":    u.ID,
			"email": u.Email,
		},
		"session": map[string]any{
			"id":        sess.ID,
			"expiresAt": sess.ExpiresAt.Format(time.RFC3339),
			"lastSeen":  sess.LastSeen.Format(time.RFC3339),
		},
	})
}

// POST /api/auth/logout
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	h.service.RevokeSessionForRequest(r)
	h.service.ClearSessionCookie(w, r)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

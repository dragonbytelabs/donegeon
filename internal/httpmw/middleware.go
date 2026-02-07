package httpmw

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"runtime/debug"
	"strings"
	"time"
)

type contextKey string

const requestIDKey contextKey = "donegeon.request_id"

func Chain(h http.Handler, middlewares ...func(http.Handler) http.Handler) http.Handler {
	if h == nil {
		h = http.NotFoundHandler()
	}
	for i := len(middlewares) - 1; i >= 0; i-- {
		h = middlewares[i](h)
	}
	return h
}

func RequestIDFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	v, _ := ctx.Value(requestIDKey).(string)
	return v
}

func WithRequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rid := strings.TrimSpace(r.Header.Get("X-Request-Id"))
		if rid == "" {
			rid = newRequestID()
		}
		w.Header().Set("X-Request-Id", rid)
		ctx := context.WithValue(r.Context(), requestIDKey, rid)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func WithRecover(logger *log.Logger) func(http.Handler) http.Handler {
	if logger == nil {
		logger = log.Default()
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					logJSON(logger, map[string]any{
						"ts":         time.Now().UTC().Format(time.RFC3339Nano),
						"level":      "error",
						"msg":        "panic_recovered",
						"request_id": RequestIDFromContext(r.Context()),
						"method":     r.Method,
						"path":       r.URL.Path,
						"panic":      fmt.Sprint(rec),
						"stack":      string(debug.Stack()),
					})

					if strings.HasPrefix(r.URL.Path, "/api/") {
						w.Header().Set("Content-Type", "application/json; charset=utf-8")
						w.WriteHeader(http.StatusInternalServerError)
						_ = json.NewEncoder(w).Encode(map[string]any{
							"error": "internal server error",
						})
						return
					}

					http.Error(w, "internal server error", http.StatusInternalServerError)
				}
			}()

			next.ServeHTTP(w, r)
		})
	}
}

func WithAccessLog(logger *log.Logger) func(http.Handler) http.Handler {
	if logger == nil {
		logger = log.Default()
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(sw, r)
			dur := time.Since(start)

			logJSON(logger, map[string]any{
				"ts":          time.Now().UTC().Format(time.RFC3339Nano),
				"level":       "info",
				"msg":         "http_request",
				"request_id":  RequestIDFromContext(r.Context()),
				"method":      r.Method,
				"path":        r.URL.Path,
				"status":      sw.status,
				"bytes":       sw.bytes,
				"duration_ms": dur.Milliseconds(),
				"remote_ip":   clientIP(r),
			})
		})
	}
}

type statusWriter struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (w *statusWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func (w *statusWriter) Write(p []byte) (int, error) {
	n, err := w.ResponseWriter.Write(p)
	w.bytes += n
	return n, err
}

func newRequestID() string {
	var b [12]byte
	if _, err := rand.Read(b[:]); err == nil {
		return hex.EncodeToString(b[:])
	}
	return fmt.Sprintf("%d", time.Now().UTC().UnixNano())
}

func clientIP(r *http.Request) string {
	if r == nil {
		return ""
	}
	if xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	if xrip := strings.TrimSpace(r.Header.Get("X-Real-Ip")); xrip != "" {
		return xrip
	}
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return host
	}
	return r.RemoteAddr
}

func logJSON(logger *log.Logger, payload map[string]any) {
	if logger == nil {
		return
	}
	b, err := json.Marshal(payload)
	if err != nil {
		logger.Printf(`{"level":"error","msg":"log_marshal_failed","error":%q}`, err.Error())
		return
	}
	logger.Print(string(b))
}

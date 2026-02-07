package serverapp

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"donegeon/internal/auth"
	"donegeon/internal/blueprint"
	"donegeon/internal/board"
	"donegeon/internal/config"
	"donegeon/internal/httpmw"
	"donegeon/internal/player"
	"donegeon/internal/plugin"
	"donegeon/internal/quest"
	"donegeon/internal/task"
	"donegeon/static"
	"donegeon/ui/page"

	"github.com/a-h/templ"
)

type Options struct {
	Config        *config.Config
	DataDir       string
	StaticDir     string
	UseDiskStatic bool
	Logger        *log.Logger
}

func NewHandler(opts Options) (http.Handler, error) {
	if opts.Config == nil {
		return nil, errors.New("config is required")
	}
	if strings.TrimSpace(opts.DataDir) == "" {
		opts.DataDir = "data"
	}
	if strings.TrimSpace(opts.StaticDir) == "" {
		opts.StaticDir = "static"
	}
	if opts.Logger == nil {
		opts.Logger = log.Default()
	}

	mux := http.NewServeMux()

	staticHandler := http.FileServer(http.FS(staticfiles.EmbeddedFS()))
	if opts.UseDiskStatic {
		staticHandler = http.FileServer(http.Dir(opts.StaticDir))
	}
	mux.Handle("/static/", http.StripPrefix("/static/", staticHandler))

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":      true,
			"service": "donegeon",
			"time":    time.Now().UTC().Format(time.RFC3339),
		})
	})

	authRepo, err := auth.NewFileRepo(filepath.Join(opts.DataDir, "auth"))
	if err != nil {
		return nil, err
	}
	authService := auth.NewService(authRepo, opts.Logger)
	logSecurityHints(opts.Logger)
	authHandler := auth.NewHandler(authService)
	mux.HandleFunc("/api/auth/request-otp", authHandler.RequestOTP)
	mux.HandleFunc("/api/auth/verify-otp", authHandler.VerifyOTP)
	mux.HandleFunc("/api/auth/session", authHandler.Session)
	mux.HandleFunc("/api/auth/logout", authHandler.Logout)

	playerRepo, err := player.NewFileRepo(filepath.Join(opts.DataDir, "player"))
	if err != nil {
		return nil, err
	}
	playerHandler := player.NewHandler()
	playerHandler.SetRepoResolver(func(r *http.Request) *player.FileRepo {
		u, ok := auth.UserFromContext(r.Context())
		if !ok {
			return playerRepo
		}
		return playerRepo.ForUser(u.ID)
	})
	mux.Handle("/api/player/state", authService.RequireAPI(http.HandlerFunc(playerHandler.State)))
	mux.Handle("/api/player/unlock", authService.RequireAPI(http.HandlerFunc(playerHandler.Unlock)))

	pluginRepo, err := plugin.NewFileRepo(filepath.Join(opts.DataDir, "plugins"))
	if err != nil {
		return nil, err
	}
	pluginHandler := plugin.NewHandler(pluginRepo)
	pluginHandler.SetRepoResolver(func(r *http.Request) plugin.Repo {
		u, ok := auth.UserFromContext(r.Context())
		if !ok {
			return pluginRepo
		}
		return pluginRepo.ForUser(u.ID)
	})
	pluginHandler.SetPlayerResolver(func(r *http.Request) *player.FileRepo {
		u, ok := auth.UserFromContext(r.Context())
		if !ok {
			return playerRepo
		}
		return playerRepo.ForUser(u.ID)
	})
	mux.Handle("/api/plugins/marketplace", authService.RequireAPI(http.HandlerFunc(pluginHandler.Marketplace)))
	mux.Handle("/api/plugins/register", authService.RequireAPI(http.HandlerFunc(pluginHandler.Register)))
	mux.Handle("/api/plugins/install", authService.RequireAPI(http.HandlerFunc(pluginHandler.Install)))
	mux.Handle("/api/plugins/uninstall", authService.RequireAPI(http.HandlerFunc(pluginHandler.Uninstall)))

	taskFileRepo, err := task.NewFileRepo(filepath.Join(opts.DataDir, "tasks"))
	if err != nil {
		return nil, err
	}
	taskHandler := task.NewHandler(taskFileRepo)
	taskHandler.SetConfig(opts.Config)
	taskHandler.SetRepoResolver(func(r *http.Request) task.Repo {
		u, ok := auth.UserFromContext(r.Context())
		if !ok {
			return taskFileRepo
		}
		return taskFileRepo.ForUser(u.ID)
	})
	taskHandler.SetPlayerResolver(func(r *http.Request) *player.FileRepo {
		u, ok := auth.UserFromContext(r.Context())
		if !ok {
			return playerRepo
		}
		return playerRepo.ForUser(u.ID)
	})
	mux.Handle("/api/tasks", authService.RequireAPI(http.HandlerFunc(taskHandler.TasksRoot)))
	mux.Handle("/api/tasks/", authService.RequireAPI(http.HandlerFunc(taskHandler.TasksSub)))
	mux.Handle("/api/tasks/live", authService.RequireAPI(http.HandlerFunc(taskHandler.TasksLive)))

	blueprintRepo, err := blueprint.NewFileRepo(filepath.Join(opts.DataDir, "blueprints"))
	if err != nil {
		return nil, err
	}
	blueprintHandler := blueprint.NewHandler(blueprintRepo)
	blueprintHandler.SetRepoResolver(func(r *http.Request) blueprint.Repo {
		u, ok := auth.UserFromContext(r.Context())
		if !ok {
			return blueprintRepo
		}
		return blueprintRepo.ForUser(u.ID)
	})
	mux.Handle("/api/blueprints", authService.RequireAPI(http.HandlerFunc(blueprintHandler.Root)))
	mux.Handle("/api/blueprints/", authService.RequireAPI(http.HandlerFunc(blueprintHandler.Sub)))

	questHandler := quest.NewHandler()
	questHandler.SetTaskRepoResolver(func(r *http.Request) task.Repo {
		u, ok := auth.UserFromContext(r.Context())
		if !ok {
			return taskFileRepo
		}
		return taskFileRepo.ForUser(u.ID)
	})
	questHandler.SetPlayerResolver(func(r *http.Request) *player.FileRepo {
		u, ok := auth.UserFromContext(r.Context())
		if !ok {
			return playerRepo
		}
		return playerRepo.ForUser(u.ID)
	})
	mux.Handle("/api/quests/state", authService.RequireAPI(http.HandlerFunc(questHandler.State)))

	boardRepo, err := board.NewFileRepo(filepath.Join(opts.DataDir, "boards"))
	if err != nil {
		return nil, err
	}
	boardHandler := board.NewHandler(boardRepo, taskFileRepo, opts.Config)
	boardHandler.SetBoardIDResolver(func(r *http.Request) string {
		u, ok := auth.UserFromContext(r.Context())
		if !ok {
			return ""
		}
		boardName := strings.TrimSpace(r.URL.Query().Get("board"))
		if boardName == "" {
			boardName = "default"
		}
		return "user_" + u.ID + "__" + boardName
	})
	boardHandler.SetTaskRepoResolver(func(r *http.Request) task.Repo {
		u, ok := auth.UserFromContext(r.Context())
		if !ok {
			return taskFileRepo
		}
		return taskFileRepo.ForUser(u.ID)
	})
	boardHandler.SetPlayerResolver(func(r *http.Request) *player.FileRepo {
		u, ok := auth.UserFromContext(r.Context())
		if !ok {
			return playerRepo
		}
		return playerRepo.ForUser(u.ID)
	})
	mux.Handle("/api/board/state", authService.RequireAPI(http.HandlerFunc(boardHandler.GetState)))
	mux.Handle("/api/board/cmd", authService.RequireAPI(http.HandlerFunc(boardHandler.Command)))

	mux.Handle("/api/config", authService.RequireAPI(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		enc := json.NewEncoder(w)
		enc.SetIndent("", "  ")
		if err := enc.Encode(opts.Config); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	})))

	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if _, err := taskFileRepo.List(task.ListFilter{Status: "all"}); err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]any{
				"ok":    false,
				"error": "task storage unavailable",
			})
			return
		}
		_ = playerRepo.GetState()
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":      true,
			"service": "donegeon",
			"time":    time.Now().UTC().Format(time.RFC3339),
		})
	})

	mux.Handle("/", templ.Handler(page.HomePage()))
	mux.Handle("/login", templ.Handler(page.LoginPage()))
	mux.HandleFunc("/app", authService.HandleAppRoute)
	mux.Handle("/board", authService.RequirePage(templ.Handler(page.BoardPage(opts.Config.UI.Board))))
	mux.Handle("/tasks", authService.RequirePage(templ.Handler(page.TasksPage())))
	mux.Handle("/builder", authService.RequirePage(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/tasks#blueprints", http.StatusFound)
	})))

	return httpmw.Chain(
		mux,
		httpmw.WithAccessLog(opts.Logger),
		httpmw.WithRequestID,
		httpmw.WithRecover(opts.Logger),
	), nil
}

func UseDiskStaticByEnv() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("DONEGEON_DEV_STATIC"))) {
	case "1", "true", "yes":
		return true
	default:
		return false
	}
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func logSecurityHints(logger *log.Logger) {
	if logger == nil {
		return
	}
	env := strings.ToLower(strings.TrimSpace(os.Getenv("DONEGEON_ENV")))
	cookieSecure := strings.ToLower(strings.TrimSpace(os.Getenv("DONEGEON_COOKIE_SECURE")))
	sameSite := strings.ToLower(strings.TrimSpace(os.Getenv("DONEGEON_COOKIE_SAMESITE")))

	if env == "production" || env == "prod" {
		if cookieSecure != "1" && cookieSecure != "true" && cookieSecure != "yes" {
			logger.Printf("[security] DONEGEON_ENV=%s but DONEGEON_COOKIE_SECURE is not explicitly true", env)
		}
		if sameSite == "" {
			logger.Printf("[security] DONEGEON_ENV=%s and DONEGEON_COOKIE_SAMESITE unset (default lax)", env)
		}
	}
}

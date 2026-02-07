package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"donegeon/internal/auth"
	"donegeon/internal/board"
	"donegeon/internal/config"
	"donegeon/internal/task"
	"donegeon/ui/page"

	"github.com/a-h/templ"
)

func main() {
	cfg, err := config.Load("donegeon_config.yml")
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	mux := http.NewServeMux()

	// Static assets
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("static"))))

	// ---- Auth ----
	authRepo, err := auth.NewFileRepo("data/auth")
	if err != nil {
		log.Fatalf("init auth repo: %v", err)
	}
	authService := auth.NewService(authRepo, log.Default())
	authHandler := auth.NewHandler(authService)
	mux.HandleFunc("/api/auth/request-otp", authHandler.RequestOTP)
	mux.HandleFunc("/api/auth/verify-otp", authHandler.VerifyOTP)
	mux.HandleFunc("/api/auth/session", authHandler.Session)
	mux.HandleFunc("/api/auth/logout", authHandler.Logout)

	// ---- Task API ----
	taskFileRepo, err := task.NewFileRepo("data/tasks")
	if err != nil {
		log.Fatalf("init task repo: %v", err)
	}
	taskHandler := task.NewHandler(taskFileRepo)
	taskHandler.SetRepoResolver(func(r *http.Request) task.Repo {
		u, ok := auth.UserFromContext(r.Context())
		if !ok {
			return taskFileRepo
		}
		return taskFileRepo.ForUser(u.ID)
	})

	mux.Handle("/api/tasks", authService.RequireAPI(http.HandlerFunc(taskHandler.TasksRoot)))      // GET,POST /api/tasks
	mux.Handle("/api/tasks/", authService.RequireAPI(http.HandlerFunc(taskHandler.TasksSub)))      // GET,PATCH /api/tasks/{id}
	mux.Handle("/api/tasks/live", authService.RequireAPI(http.HandlerFunc(taskHandler.TasksLive))) // PUT /api/tasks/live

	// ---- Board API ----
	boardRepo, err := board.NewFileRepo("data/boards")
	if err != nil {
		log.Fatalf("init board repo: %v", err)
	}
	boardHandler := board.NewHandler(boardRepo, taskFileRepo, cfg)
	boardHandler.SetBoardIDResolver(func(r *http.Request) string {
		u, ok := auth.UserFromContext(r.Context())
		if !ok {
			return ""
		}
		boardName := strings.TrimSpace(r.URL.Query().Get("board"))
		if boardName == "" {
			boardName = "default"
		}
		// Scope board files by user to avoid cross-user leakage.
		return "user_" + u.ID + "__" + boardName
	})
	boardHandler.SetTaskRepoResolver(func(r *http.Request) task.Repo {
		u, ok := auth.UserFromContext(r.Context())
		if !ok {
			return taskFileRepo
		}
		return taskFileRepo.ForUser(u.ID)
	})

	mux.Handle("/api/board/state", authService.RequireAPI(http.HandlerFunc(boardHandler.GetState))) // GET /api/board/state
	mux.Handle("/api/board/cmd", authService.RequireAPI(http.HandlerFunc(boardHandler.Command)))    // POST /api/board/cmd

	// API: expose config to frontend (read-only)
	mux.Handle("/api/config", authService.RequireAPI(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		enc := json.NewEncoder(w)
		enc.SetIndent("", "  ")
		if err := enc.Encode(cfg); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	})))

	// Pages
	mux.Handle("/", templ.Handler(page.HomePage()))
	mux.Handle("/login", templ.Handler(page.LoginPage()))
	mux.HandleFunc("/app", authService.HandleAppRoute)
	mux.Handle("/board", authService.RequirePage(templ.Handler(page.BoardPage(cfg.UI.Board))))
	mux.Handle("/tasks", authService.RequirePage(templ.Handler(page.TasksPage())))

	addr := ":42069"
	log.Printf("listening on http://localhost%s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

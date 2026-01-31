package main

import (
	"encoding/json"
	"log"
	"net/http"

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

	// ---- Task API ----
	taskRepo := task.NewMemoryRepo()
	taskHandler := task.NewHandler(taskRepo)

	mux.HandleFunc("/api/tasks", taskHandler.TasksRoot)      // POST /api/tasks
	mux.HandleFunc("/api/tasks/", taskHandler.TasksSub)      // GET/PATCH /api/tasks/{id}, PUT /api/tasks/{id}/modifiers
	mux.HandleFunc("/api/tasks/live", taskHandler.TasksLive) // PUT /api/tasks/live

	// ---- Board API ----
	boardRepo, err := board.NewFileRepo("data/boards")
	if err != nil {
		log.Fatalf("init board repo: %v", err)
	}
	boardHandler := board.NewHandler(boardRepo, cfg)

	mux.HandleFunc("/api/board/state", boardHandler.GetState) // GET /api/board/state
	mux.HandleFunc("/api/board/cmd", boardHandler.Command)    // POST /api/board/cmd

	// API: expose config to frontend (read-only)
	mux.HandleFunc("/api/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		enc := json.NewEncoder(w)
		enc.SetIndent("", "  ")
		if err := enc.Encode(cfg); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	})

	// Pages
	mux.Handle("/", templ.Handler(page.HomePage()))
	mux.Handle("/board", templ.Handler(page.BoardPage(cfg.UI.Board)))
	mux.Handle("/tasks", templ.Handler(page.TasksPage()))

	addr := ":42069"
	log.Printf("listening on http://localhost%s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

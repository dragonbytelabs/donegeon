package main

import (
	"encoding/json"
	"log"
	"net/http"

	"donegeon/internal/config"
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

	// Page
	mux.Handle("/", templ.Handler(page.HomePage()))
	mux.Handle("/board", templ.Handler(page.BoardPage(cfg.UI.Board)))

	addr := ":42069"
	log.Printf("listening on http://localhost%s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

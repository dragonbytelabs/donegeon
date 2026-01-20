package main

import (
	"log"
	"net/http"

	"cleartify/ui"
	"cleartify/ui/page"

	"github.com/a-h/templ"
)

func main() {
	mux := http.NewServeMux()

	// Static assets
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("static"))))

	// Page
	mux.Handle("/", templ.Handler(page.HomePage()))
	mux.Handle("/builder", templ.Handler(ui.BuilderPage()))
	mux.Handle("/board", templ.Handler(page.BoardPage()))

	addr := ":42069"
	log.Printf("listening on http://localhost%s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

package server

import (
	"embed"
	"html/template"
	"net/http"
	"strings"
)

//go:embed templates/admin.html
var adminTemplatesFS embed.FS

var adminTmpl = template.Must(
	template.New("admin.html").
		Funcs(template.FuncMap{
			"contains": func(s, sub string) bool { return strings.Contains(s, sub) },
		}).
		ParseFS(adminTemplatesFS, "templates/admin.html"),
)

type adminPageData struct {
	Port   string
	Routes []RouteDoc
}

func RegisterAdminUI(mux *http.ServeMux, rr *RouteRegistry, port string) {
	// JSON list (handy for tooling)
	mux.HandleFunc("GET /_/admin/routes.json", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, rr.List())
	})

	// HTML
	mux.HandleFunc("GET /_/admin", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")

		data := adminPageData{
			Port:   port,
			Routes: rr.List(),
		}

		if err := adminTmpl.Execute(w, data); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
	})
}

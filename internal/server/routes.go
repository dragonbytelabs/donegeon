package server

import (
	"net/http"
	"strings"
)

type RouteDoc struct {
	Method      string `json:"method"`
	Pattern     string `json:"pattern"`
	Summary     string `json:"summary,omitempty"`
	ExampleBody string `json:"example_body,omitempty"`
}

type RouteRegistry struct {
	routes []RouteDoc
}

func (rr *RouteRegistry) Add(doc RouteDoc) {
	rr.routes = append(rr.routes, doc)
}

func (rr *RouteRegistry) List() []RouteDoc {
	out := make([]RouteDoc, len(rr.routes))
	copy(out, rr.routes)
	return out
}

func Handle(mux *http.ServeMux, rr *RouteRegistry, methodAndPattern, summary, exampleBody string, h http.HandlerFunc) {
	parts := strings.SplitN(methodAndPattern, " ", 2)
	method, pattern := parts[0], ""
	if len(parts) == 2 {
		pattern = parts[1]
	}
	rr.Add(RouteDoc{Method: method, Pattern: pattern, Summary: summary, ExampleBody: exampleBody})
	mux.HandleFunc(methodAndPattern, h)
}

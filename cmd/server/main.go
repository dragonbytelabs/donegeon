package main

import (
	"log"
	"net/http"

	"donegeon/internal/config"
	"donegeon/internal/serverapp"
)

func main() {
	cfg, err := config.Load("donegeon_config.yml")
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	handler, err := serverapp.NewHandler(serverapp.Options{
		Config:        cfg,
		DataDir:       "data",
		StaticDir:     "static",
		UseDiskStatic: serverapp.UseDiskStaticByEnv(),
		Logger:        log.Default(),
	})
	if err != nil {
		log.Fatalf("build server: %v", err)
	}

	addr := ":42069"
	log.Printf("listening on http://localhost%s", addr)
	log.Fatal(http.ListenAndServe(addr, handler))
}

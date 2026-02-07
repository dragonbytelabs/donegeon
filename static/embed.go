package staticfiles

import (
	"embed"
	"io/fs"
)

//go:embed css/* js/*
var embedded embed.FS

func EmbeddedFS() fs.FS {
	return embedded
}

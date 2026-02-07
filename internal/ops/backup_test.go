package ops

import (
	"archive/tar"
	"compress/gzip"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestBackupRestoreDataDir_RoundTrip(t *testing.T) {
	src := filepath.Join(t.TempDir(), "src")
	if err := os.MkdirAll(filepath.Join(src, "tasks"), 0o755); err != nil {
		t.Fatalf("mkdir src: %v", err)
	}
	if err := os.MkdirAll(filepath.Join(src, "boards"), 0o755); err != nil {
		t.Fatalf("mkdir src boards: %v", err)
	}

	files := map[string]string{
		"tasks/tasks.json":  `{"users":{"u1":{"tasks":{"task_1":{"title":"Laundry"}}}}}`,
		"boards/b1.json":    `{"stacks":{},"cards":{},"nextZ":10}`,
		"player/state.json": `{"users":{"u1":{"loot":{"coin":5}}}}`,
	}
	for rel, content := range files {
		path := filepath.Join(src, rel)
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatalf("mkdir parent %s: %v", path, err)
		}
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			t.Fatalf("write %s: %v", path, err)
		}
	}

	archive := filepath.Join(t.TempDir(), "backup.tar.gz")
	if err := BackupDataDir(src, archive); err != nil {
		t.Fatalf("backup failed: %v", err)
	}
	if _, err := os.Stat(archive); err != nil {
		t.Fatalf("archive missing: %v", err)
	}

	restoreDir := filepath.Join(t.TempDir(), "restore")
	if err := RestoreDataDir(archive, restoreDir); err != nil {
		t.Fatalf("restore failed: %v", err)
	}

	got := map[string]string{}
	err := filepath.WalkDir(restoreDir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(restoreDir, path)
		if err != nil {
			return err
		}
		b, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		got[filepath.ToSlash(rel)] = string(b)
		return nil
	})
	if err != nil {
		t.Fatalf("walk restore dir: %v", err)
	}

	if !reflect.DeepEqual(files, got) {
		t.Fatalf("restored files mismatch:\nwant=%v\ngot=%v", files, got)
	}
}

func TestRestoreDataDir_RejectsPathTraversal(t *testing.T) {
	archive := filepath.Join(t.TempDir(), "bad.tar.gz")
	f, err := os.Create(archive)
	if err != nil {
		t.Fatalf("create archive: %v", err)
	}

	gz := gzip.NewWriter(f)
	tw := tar.NewWriter(gz)
	if err := tw.WriteHeader(&tar.Header{
		Name:     "../escape.txt",
		Typeflag: tar.TypeReg,
		Mode:     0o644,
		Size:     int64(len("bad")),
	}); err != nil {
		t.Fatalf("write header: %v", err)
	}
	if _, err := tw.Write([]byte("bad")); err != nil {
		t.Fatalf("write body: %v", err)
	}
	if err := tw.Close(); err != nil {
		t.Fatalf("close tar writer: %v", err)
	}
	if err := gz.Close(); err != nil {
		t.Fatalf("close gzip writer: %v", err)
	}
	if err := f.Close(); err != nil {
		t.Fatalf("close file: %v", err)
	}

	if err := RestoreDataDir(archive, filepath.Join(t.TempDir(), "out")); err == nil {
		t.Fatalf("expected restore to reject path traversal archive")
	}
}

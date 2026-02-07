package main

import (
	"crypto/sha256"
	"encoding/hex"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"time"

	"donegeon/internal/ops"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(2)
	}

	switch os.Args[1] {
	case "backup":
		if err := cmdBackup(os.Args[2:]); err != nil {
			fmt.Fprintln(os.Stderr, "backup failed:", err)
			os.Exit(1)
		}
	case "restore":
		if err := cmdRestore(os.Args[2:]); err != nil {
			fmt.Fprintln(os.Stderr, "restore failed:", err)
			os.Exit(1)
		}
	case "drill":
		if err := cmdDrill(os.Args[2:]); err != nil {
			fmt.Fprintln(os.Stderr, "drill failed:", err)
			os.Exit(1)
		}
	default:
		printUsage()
		os.Exit(2)
	}
}

func cmdBackup(args []string) error {
	fs := flag.NewFlagSet("backup", flag.ContinueOnError)
	dataDir := fs.String("data-dir", "data", "path to data directory")
	out := fs.String("out", "", "output archive path (.tar.gz)")
	if err := fs.Parse(args); err != nil {
		return err
	}

	if *out == "" {
		ts := time.Now().UTC().Format("20060102T150405Z")
		*out = filepath.Join("backups", "donegeon-"+ts+".tar.gz")
	}

	if err := ops.BackupDataDir(*dataDir, *out); err != nil {
		return err
	}
	fmt.Println(*out)
	return nil
}

func cmdRestore(args []string) error {
	fs := flag.NewFlagSet("restore", flag.ContinueOnError)
	archive := fs.String("archive", "", "input backup archive (.tar.gz)")
	target := fs.String("target-dir", "data-restored", "restore target directory")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *archive == "" {
		return fmt.Errorf("archive is required")
	}
	return ops.RestoreDataDir(*archive, *target)
}

func cmdDrill(args []string) error {
	fs := flag.NewFlagSet("drill", flag.ContinueOnError)
	dataDir := fs.String("data-dir", "data", "path to data directory")
	workDir := fs.String("work-dir", os.TempDir(), "temporary workspace for drill artifacts")
	if err := fs.Parse(args); err != nil {
		return err
	}

	if err := os.MkdirAll(*workDir, 0o755); err != nil {
		return err
	}
	ts := time.Now().UTC().Format("20060102T150405Z")
	archive := filepath.Join(*workDir, "donegeon-drill-"+ts+".tar.gz")
	restoreDir := filepath.Join(*workDir, "donegeon-drill-restore-"+ts)

	if err := ops.BackupDataDir(*dataDir, archive); err != nil {
		return err
	}
	if err := ops.RestoreDataDir(archive, restoreDir); err != nil {
		return err
	}

	srcDigest, err := dirDigest(*dataDir)
	if err != nil {
		return err
	}
	restoreDigest, err := dirDigest(restoreDir)
	if err != nil {
		return err
	}
	if srcDigest != restoreDigest {
		return fmt.Errorf("digest mismatch after restore: src=%s restored=%s", srcDigest, restoreDigest)
	}

	fmt.Println("backup:", archive)
	fmt.Println("restored:", restoreDir)
	fmt.Println("digest:", srcDigest)
	return nil
}

func dirDigest(root string) (string, error) {
	root = filepath.Clean(root)
	entries := []string{}
	if err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		entries = append(entries, filepath.ToSlash(rel))
		return nil
	}); err != nil {
		return "", err
	}
	sort.Strings(entries)

	h := sha256.New()
	for _, rel := range entries {
		_, _ = io.WriteString(h, rel)
		_, _ = io.WriteString(h, "\n")
		b, err := os.ReadFile(filepath.Join(root, rel))
		if err != nil {
			return "", err
		}
		if _, err := h.Write(b); err != nil {
			return "", err
		}
		_, _ = io.WriteString(h, "\n")
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func printUsage() {
	fmt.Println("usage:")
	fmt.Println("  donegeon-ops backup  --data-dir data --out backups/backup.tar.gz")
	fmt.Println("  donegeon-ops restore --archive backups/backup.tar.gz --target-dir data-restored")
	fmt.Println("  donegeon-ops drill   --data-dir data --work-dir /tmp")
}

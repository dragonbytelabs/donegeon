package ops

import (
	"archive/tar"
	"compress/gzip"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

func BackupDataDir(srcDir, archivePath string) error {
	srcDir = filepath.Clean(strings.TrimSpace(srcDir))
	archivePath = filepath.Clean(strings.TrimSpace(archivePath))
	if srcDir == "" || archivePath == "" {
		return fmt.Errorf("srcDir and archivePath are required")
	}
	info, err := os.Stat(srcDir)
	if err != nil {
		return err
	}
	if !info.IsDir() {
		return fmt.Errorf("source is not a directory: %s", srcDir)
	}
	if err := os.MkdirAll(filepath.Dir(archivePath), 0o755); err != nil {
		return err
	}

	f, err := os.Create(archivePath)
	if err != nil {
		return err
	}
	defer f.Close()

	gz := gzip.NewWriter(f)
	defer gz.Close()

	tw := tar.NewWriter(gz)
	defer tw.Close()

	return filepath.WalkDir(srcDir, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if path == srcDir {
			return nil
		}

		rel, err := filepath.Rel(srcDir, path)
		if err != nil {
			return err
		}
		rel = filepath.ToSlash(rel)

		if d.Type()&os.ModeSymlink != 0 {
			// Skip symlinks for predictable backup/restore.
			return nil
		}

		info, err := d.Info()
		if err != nil {
			return err
		}

		hdr, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}
		hdr.Name = rel
		if info.IsDir() && !strings.HasSuffix(hdr.Name, "/") {
			hdr.Name += "/"
		}
		if err := tw.WriteHeader(hdr); err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}

		src, err := os.Open(path)
		if err != nil {
			return err
		}
		defer src.Close()

		if _, err := io.Copy(tw, src); err != nil {
			return err
		}
		return nil
	})
}

func RestoreDataDir(archivePath, targetDir string) error {
	archivePath = filepath.Clean(strings.TrimSpace(archivePath))
	targetDir = filepath.Clean(strings.TrimSpace(targetDir))
	if archivePath == "" || targetDir == "" {
		return fmt.Errorf("archivePath and targetDir are required")
	}
	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		return err
	}

	f, err := os.Open(archivePath)
	if err != nil {
		return err
	}
	defer f.Close()

	gz, err := gzip.NewReader(f)
	if err != nil {
		return err
	}
	defer gz.Close()

	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		rel, err := sanitizeArchiveRelPath(hdr.Name)
		if err != nil {
			return err
		}
		outPath := filepath.Join(targetDir, rel)

		switch hdr.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(outPath, os.FileMode(hdr.Mode)); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(outPath), 0o755); err != nil {
				return err
			}
			dst, err := os.OpenFile(outPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, os.FileMode(hdr.Mode))
			if err != nil {
				return err
			}
			if _, err := io.Copy(dst, tr); err != nil {
				_ = dst.Close()
				return err
			}
			if err := dst.Close(); err != nil {
				return err
			}
		default:
			// Ignore unsupported entry types.
		}
	}

	return nil
}

func sanitizeArchiveRelPath(name string) (string, error) {
	name = filepath.Clean(strings.TrimSpace(name))
	if name == "." || name == "" {
		return "", fmt.Errorf("invalid archive entry path")
	}
	if filepath.IsAbs(name) {
		return "", fmt.Errorf("invalid absolute archive entry path: %s", name)
	}
	if strings.HasPrefix(name, ".."+string(filepath.Separator)) || name == ".." {
		return "", fmt.Errorf("invalid archive entry path traversal: %s", name)
	}
	return name, nil
}

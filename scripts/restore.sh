#!/usr/bin/env bash
set -euo pipefail

ARCHIVE_PATH="${1:-}"
TARGET_DIR="${2:-data-restored}"

if [[ -z "${ARCHIVE_PATH}" ]]; then
  echo "usage: $0 <archive-path> [target-dir]" >&2
  exit 2
fi

go run ./cmd/ops/main.go restore --archive "${ARCHIVE_PATH}" --target-dir "${TARGET_DIR}"


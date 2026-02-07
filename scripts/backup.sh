#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="${1:-data}"
OUT_PATH="${2:-}"

if [[ -n "${OUT_PATH}" ]]; then
  go run ./cmd/ops/main.go backup --data-dir "${DATA_DIR}" --out "${OUT_PATH}"
else
  go run ./cmd/ops/main.go backup --data-dir "${DATA_DIR}"
fi


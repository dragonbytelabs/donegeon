#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="${1:-data}"
WORK_DIR="${2:-/tmp}"

go run ./cmd/ops/main.go drill --data-dir "${DATA_DIR}" --work-dir "${WORK_DIR}"


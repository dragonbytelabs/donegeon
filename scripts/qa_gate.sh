#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
THRESHOLD="${1:-${COVERAGE_THRESHOLD:-90}}"

echo "==> Donegeon QA gate start"
echo "Root: ${ROOT_DIR}"
echo "Coverage threshold: ${THRESHOLD}%"

"${ROOT_DIR}/scripts/uat_smoke.sh"
"${ROOT_DIR}/scripts/coverage_gate.sh" "${THRESHOLD}"

echo "==> Frontend production build"
(
  cd "${ROOT_DIR}/frontend/packages/web"
  bun run build
)

echo "==> Verifying static bundles"
for f in login.js onboarding.js tasks.js board.js sw.js; do
  path="${ROOT_DIR}/static/js/${f}"
  if [[ ! -s "${path}" ]]; then
    echo "ERROR: Missing or empty bundle: ${path}" >&2
    exit 1
  fi
done

echo "QA gate passed."

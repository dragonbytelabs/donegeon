#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
THRESHOLD="${1:-${COVERAGE_THRESHOLD:-90}}"
GOCACHE_DIR="${GOCACHE:-/tmp/go-build}"

ARTIFACT_DIR="${ROOT_DIR}/.artifacts/coverage"
PROFILE_PATH="${ARTIFACT_DIR}/coverage.out"
LOG_PATH="${ARTIFACT_DIR}/go-test.log"
FUNC_PATH="${ARTIFACT_DIR}/coverage.func.txt"

mkdir -p "${ARTIFACT_DIR}"

echo "==> Go coverage run (threshold: ${THRESHOLD}%)"
(
  cd "${ROOT_DIR}"
  GOCACHE="${GOCACHE_DIR}" go test ./... -covermode=atomic -coverprofile="${PROFILE_PATH}" | tee "${LOG_PATH}"
  GOCACHE="${GOCACHE_DIR}" go tool cover -func="${PROFILE_PATH}" > "${FUNC_PATH}"
)

TOTAL_COVERAGE="$(
  awk '/^total:/{gsub("%","",$3); print $3}' "${FUNC_PATH}" | tail -n 1
)"

if [[ -z "${TOTAL_COVERAGE}" ]]; then
  echo "ERROR: Unable to read total coverage from ${FUNC_PATH}" >&2
  exit 1
fi

echo "Total coverage: ${TOTAL_COVERAGE}%"
echo "Coverage total line: $(tail -n 1 "${FUNC_PATH}")"
echo "Coverage report: ${FUNC_PATH}"
echo "Coverage profile: ${PROFILE_PATH}"

if ! awk -v cov="${TOTAL_COVERAGE}" -v req="${THRESHOLD}" 'BEGIN { exit (cov+0 >= req+0) ? 0 : 1 }'; then
  echo "ERROR: Coverage gate failed (${TOTAL_COVERAGE}% < ${THRESHOLD}%)." >&2
  exit 1
fi

echo "Coverage gate passed."

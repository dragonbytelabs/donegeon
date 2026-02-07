# Donegeon Runbook

Last updated: 2026-02-07

## Service Basics

- Binary entrypoint: `go run ./cmd/server/main.go`
- Default bind: `http://localhost:42069`
- Health checks:
  - Liveness: `GET /healthz`
  - Readiness: `GET /readyz`
- Request correlation:
  - Response header: `X-Request-Id`
  - Structured access logs include `request_id`, `path`, `status`, and `duration_ms`.

## Production Environment

Auth/session and cookie controls:

- `DONEGEON_COOKIE_SECURE`:
  - `true/1/yes`: force secure cookies.
  - `false/0/no`: disable secure cookies (dev only).
  - unset: auto-detect HTTPS via TLS or `X-Forwarded-Proto=https`.
- `DONEGEON_COOKIE_NAME` (default: `donegeon_session`)
- `DONEGEON_COOKIE_PATH` (default: `/`)
- `DONEGEON_COOKIE_DOMAIN` (default: unset)
- `DONEGEON_COOKIE_SAMESITE` (default: `lax`; supported: `lax`, `strict`, `none`)
- `DONEGEON_SESSION_TTL_HOURS` (default: `168`)
- `DONEGEON_OTP_TTL_MINUTES` (default: `10`)
- `DONEGEON_OTP_MAX_ATTEMPTS` (default: `5`)

Static asset mode:

- `DONEGEON_DEV_STATIC=1`: serve static assets from disk.
- unset/other: serve embedded static assets from the binary.

## Backup and Restore

Backup artifact format: `.tar.gz`

Commands:

- Backup:
  - `./scripts/backup.sh data`
- Restore into a separate directory:
  - `./scripts/restore.sh backups/<artifact>.tar.gz data-restored`
- Backup/restore drill (creates artifact + restore and verifies content digest):
  - `./scripts/backup_drill.sh data /tmp`

Low-level CLI:

- `go run ./cmd/ops/main.go backup --data-dir data --out backups/donegeon.tar.gz`
- `go run ./cmd/ops/main.go restore --archive backups/donegeon.tar.gz --target-dir data-restored`
- `go run ./cmd/ops/main.go drill --data-dir data --work-dir /tmp`

## Incident Quick Actions

### Auth failures spike

1. Check `/readyz` and logs for auth repo read/write errors.
2. Verify `data/auth/auth.json` exists and is writable.
3. Confirm cookie settings (`DONEGEON_COOKIE_*`) match deployment domain and HTTPS.

### Board/task data inconsistency

1. Capture `X-Request-Id` from failing request.
2. Correlate request log entry and command path (`/api/board/cmd`, `/api/tasks/*`).
3. If data corruption is confirmed, restore from latest backup artifact into a clean directory and validate before swap.

### Restore procedure (planned maintenance)

1. Stop application process.
2. Restore artifact into fresh directory (for example `data-restored`).
3. Validate JSON files and run smoke checks (`/healthz`, `/readyz`, auth login, `/tasks`, `/board`).
4. Swap directories atomically and restart.


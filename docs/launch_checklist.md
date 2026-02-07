# Donegeon Launch Checklist

Last updated: 2026-02-07

## Release Gate

- [ ] No open P0 defects (auth bypass, data loss/corruption, broken login).
- [ ] `docs/p0_defects.md` reviewed and up to date.
- [ ] `go test ./...` passing.
- [ ] Frontend build passing (`bun run build` in `frontend/packages/web`).
- [ ] QA gate passing (`./scripts/qa_gate.sh 90`), or approved exception documented.
- [ ] Production env variables reviewed for auth/session cookies.

## Security Review (Auth/Session)

- [ ] `DONEGEON_COOKIE_SECURE=true` in production.
- [ ] `DONEGEON_COOKIE_SAMESITE` set for deployment policy (`lax` or `strict`; `none` only if cross-site needed and HTTPS enforced).
- [ ] `DONEGEON_COOKIE_DOMAIN` matches deployed app domain.
- [ ] `DONEGEON_SESSION_TTL_HOURS` confirmed for risk posture.
- [ ] OTP controls reviewed (`DONEGEON_OTP_TTL_MINUTES`, `DONEGEON_OTP_MAX_ATTEMPTS`).
- [ ] HTTPS termination forwards `X-Forwarded-Proto=https`.

## Backup/Restore Drill

- [ ] Run drill: `./scripts/backup_drill.sh data /tmp`
- [ ] Archive artifact path captured.
- [ ] Restored directory validated (tasks, boards, auth/session JSON present).
- [ ] Smoke test against restored data succeeds.

## Operations Readiness

- [ ] Liveness check configured: `GET /healthz`
- [ ] Readiness check configured: `GET /readyz`
- [ ] Log pipeline captures `request_id` and status fields.
- [ ] On-call has access to runbook (`docs/runbook.md`).
- [ ] UAT runbook completed (`uat.md`) with evidence links.

## Sign-off

- [ ] Engineering
- [ ] Product
- [ ] Operations

# Donegeon Production Backlog

This backlog turns the roadmap into sprint-sized deliverables with acceptance criteria.
Assumptions:
- Team velocity: 1-2 engineers.
- Sprint length: 1 week.
- Current baseline date: 2026-02-07.

## Sprint 1: Auth + Session Foundation (Phase 1 start)

### Ticket: Add OTP auth domain and persistence
- Scope:
  - Add user/session/otp domain models.
  - Add persistent auth repo under `data/auth/`.
  - Add repo methods for create user, issue/verify OTP, create/validate/revoke session.
- Acceptance criteria:
  - Auth state survives server restarts.
  - OTP challenges expire automatically by timestamp validation.
  - Session lookup returns unauthenticated for expired sessions.

### Ticket: Add auth API endpoints
- Scope:
  - `POST /api/auth/request-otp` with email.
  - `POST /api/auth/verify-otp` with email + 6-digit code.
  - `GET /api/auth/session`.
  - `POST /api/auth/logout`.
- Acceptance criteria:
  - Request OTP logs a 6-digit code on the backend for local verification.
  - Verify OTP issues HttpOnly session cookie.
  - Session endpoint returns authenticated user when cookie is valid.
  - Logout invalidates session and clears cookie.

### Ticket: Add app/login routing and gating
- Scope:
  - Add `/app` route: redirect to `/tasks` when session valid, else `/login`.
  - Add `/login` page route.
  - Gate `/tasks` and `/board` pages behind session middleware.
- Acceptance criteria:
  - Unauthenticated browser request to `/tasks` or `/board` redirects to `/login`.
  - Authenticated request can access `/tasks` and `/board`.
  - `/app` becomes the main entry from header.

### Ticket: Add login UI (email -> OTP flow)
- Scope:
  - Add login page with two-step interaction.
  - Step 1 posts email to request OTP.
  - Step 2 posts code to verify and navigates to `/app`.
- Acceptance criteria:
  - User can request OTP with valid email format.
  - User can verify using the backend logged code.
  - On success, browser lands on `/tasks` via `/app` redirect.

## Sprint 2: Durable App Data (Phase 1 complete)

### Ticket: Persist tasks to durable storage
- Scope:
  - Replace in-memory task repo with persistent repo under `data/tasks/` (or DB-backed adapter).
  - Keep existing API behavior.
- Acceptance criteria:
  - Tasks survive server restart.
  - Existing list/filter/update behavior remains unchanged.

### Ticket: Add board ownership and user scoping
- Scope:
  - Scope board IDs by user/session.
  - Ensure one user cannot access another user’s board state.
- Acceptance criteria:
  - Authenticated user only sees own board/task state.
  - Data leakage across users is not possible by query param manipulation.

### Ticket: Add auth hardening basics
- Scope:
  - OTP attempt limits and cooldown.
  - Session TTL refresh policy.
  - Basic audit logging.
- Acceptance criteria:
  - Too many bad OTP attempts returns 429/403 with clear message.
  - Session expiry is enforced server-side.
  - Auth events logged with timestamp and email/user id.

## Sprint 3: Server-Authoritative Board (Phase 2)

### Ticket: Stop full client overwrite as authoritative path
- Scope:
  - Deprecate `PUT /api/board/state` for normal gameplay mutations.
  - Use command endpoints as canonical mutation path.
- Acceptance criteria:
  - Move/split/merge state remains consistent after reload.
  - Conflict paths return deterministic errors and do not corrupt state.

### Ticket: Sync deck open/task create through server commands
- Scope:
  - Add commands for deck open and card spawn.
  - Frontend stops spawning authoritative cards locally.
- Acceptance criteria:
  - Deck draws and created cards are replayable from server state only.
  - Frontend can recover fully from `GET /api/board/state`.

## Sprint 4: Core Task Loop Rules (Phase 3)

### Ticket: Enforce villager assignment for completion
- Scope:
  - Add server validation for `completion_requires_assigned_villager`.
  - Expose completion availability in task payload/board card data.
- Acceptance criteria:
  - Task cannot be marked done without assigned villager.
  - UI only shows done action when server says completion is legal.

### Ticket: Add task processing action
- Scope:
  - Add `task.process` command/API path.
  - Record progress metadata needed for recurrence and rewards.
- Acceptance criteria:
  - Processing consumes configured stamina cost.
  - Processing updates task progression in persistent state.

## Sprint 5: Day Tick, Overdue, Zombies, Recurrence (Phase 4)

### Ticket: Implement day tick worker
- Scope:
  - Add daily tick execution path.
  - Evaluate overdue tasks and recurrence.
- Acceptance criteria:
  - Overdue tasks generate zombie pressure based on config caps.
  - Recurring tasks reschedule/spawn according to config.

### Ticket: Add zombie entities and clear action
- Scope:
  - Spawn zombie cards/entities from overdue causes.
  - Add clear action with stamina/reward effects.
- Acceptance criteria:
  - Zombie penalties apply while active.
  - Clearing zombies removes penalties and grants rewards.

## Sprint 6: Progression Systems (Phase 5)

### Ticket: Villager XP/level/perks
- Scope:
  - Apply XP from task clear/gather/zombie actions.
  - Support perk selection and stat modifiers.
- Acceptance criteria:
  - XP thresholds from config are enforced.
  - Selected perks affect stamina/speed/cost rules.

### Ticket: Deck economy and unlocks
- Scope:
  - Enforce unlock conditions and deck costs.
  - Add deterministic seeded draws server-side.
- Acceptance criteria:
  - Locked decks cannot be opened before unlock.
  - Deck costs include zombie/overrun multipliers.

## Sprint 7: Production Hardening (Phase 6)

### Ticket: Asset embedding and release packaging
- Scope:
  - Embed static assets with Go `embed`.
  - Keep dev mode file serving optional.
- Acceptance criteria:
  - Single binary serves frontend assets without external static dir.
  - Embedded assets match current build output.

### Ticket: Testing and quality gates
- Scope:
  - Add unit tests for auth, board validation, task rules.
  - Add integration tests for OTP login and protected routes.
- Acceptance criteria:
  - CI runs tests on every push.
  - Critical auth and rule flows have automated coverage.

### Ticket: Ops baseline
- Scope:
  - Add structured logging and panic recovery middleware.
  - Add request IDs and basic health/readiness endpoints.
- Acceptance criteria:
  - Production logs include request correlation ID.
  - Service exposes health endpoint suitable for deploy platform probes.

## Sprint 8: Beta and Launch (Phase 7)

### Ticket: Closed beta feedback loop
- Scope:
  - Ship beta build to limited users.
  - Collect gameplay balancing and UX feedback.
- Acceptance criteria:
  - At least one feedback cycle incorporated into config/rules.
  - No P0 auth/data-loss defects open before launch.

### Ticket: Launch checklist
- Scope:
  - Backup/restore drill.
  - Security review of auth/session settings.
  - Final docs for runbook and support.
- Acceptance criteria:
  - Restore test proven from backup artifact.
  - Session and cookie settings verified for production HTTPS.

### Node monorepo (Bun + Solid + Hono) migration

This repo currently contains a Go backend + React frontend. We’re migrating to an all-Node monorepo:

- `packages/donegeon`: shared TypeScript gameplay/engine library
- `packages/backend`: Hono API (Bun runtime)
- `packages/frontend`: SolidJS + Vite + Tailwind
- `packages/infra`: SST (placeholder for now)

### Workspace tooling

We use Bun workspaces via the root `package.json`:

- Local packages are linked via `workspace:*`
- Run package scripts via Bun filters, e.g. `bun run --filter ./packages/backend dev`

### About the “catalog protocol”

We use Bun’s **Catalogs** to keep dependency versions consistent across packages.
Catalog versions are defined once in the root `package.json` and referenced in workspaces using the `catalog:` protocol.

Recommendation:
- Use **`workspace:*`** for local package linking.
- Use **`catalog:`** for shared dependency versions across the monorepo. See Bun docs: `https://bun.com/docs/pm/catalogs`.

### Dev workflow

- Backend:

```bash
bun install
bun run dev:backend
```

- Frontend (separate terminal):

```bash
bun run dev:frontend
```

The frontend proxies `/api/*` to `http://localhost:3000`.


import { Hono } from 'hono';
import type { VersionResponse } from '@donegeon/app/api';
import { apiRouter } from './routes/index.js';
import { attachStateToContext } from './core/state.js';

const app = new Hono();

app.use('*', async (c, next) => {
  attachStateToContext(c);
  await next();
});

app.get('/healthz', (c) => c.text('ok'));

app.get('/api/version', (c) => {
  const body: VersionResponse = { name: 'donegeon-backend', version: '0.1.0' };
  return c.json(body);
});

app.route('/api', apiRouter);

export const honoApp = app;

// Bun dev/prod entrypoint: Bun will call `Bun.serve(defaultExport)` when `default.fetch` exists.
const port = Number(process.env.PORT ?? 3000);
export default { port, fetch: app.fetch };


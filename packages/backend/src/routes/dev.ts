import { Hono } from 'hono';
import { stateFromContext } from '../core/state.js';

export const devRouter = new Hono();

devRouter.get('/dev/config', (c) => {
  const st = stateFromContext(c);
  return c.json(st.engine.getBalanceConfig());
});

devRouter.get('/dev/stats', (c) => {
  // Telemetry isn’t implemented yet; return a stable shape.
  return c.json({
    status: 'telemetry_not_enabled',
    since_days: 30,
    events: 0
  });
});


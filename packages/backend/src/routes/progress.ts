import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { stateFromContext } from '../core/state.js';

export const progressRouter = new Hono();

progressRouter.post('/progress', zValidator('json', z.object({}).passthrough()), (c) => {
  const st = stateFromContext(c);
  st.questService.refreshProgress();
  return c.json({ ok: true });
});


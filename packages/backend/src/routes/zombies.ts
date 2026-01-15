import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { jsonError } from './_shared.js';
import { stateFromContext } from '../core/state.js';

export const zombiesRouter = new Hono();

zombiesRouter.get('/zombies', (c) => {
  const st = stateFromContext(c);
  return c.json(st.zombieRepo.list());
});

zombiesRouter.post(
  '/zombies/clear',
  zValidator('json', z.object({ zombie_id: z.string().min(1), slots: z.number().int().positive() })),
  (c) => {
    const st = stateFromContext(c);
    const body = c.req.valid('json');
    try {
      const res = st.engine.clearZombie(body.zombie_id, body.slots);
      return c.json(res);
    } catch (e: any) {
      return jsonError(c, 400, String(e?.message ?? e));
    }
  }
);


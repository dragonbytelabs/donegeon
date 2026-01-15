import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { jsonError } from './_shared.js';
import { stateFromContext } from '../core/state.js';

export const buildingsRouter = new Hono();

buildingsRouter.get('/buildings', (c) => {
  const st = stateFromContext(c);
  return c.json(st.buildingRepo.list());
});

buildingsRouter.post(
  '/buildings/construct',
  zValidator('json', z.object({ type: z.string().min(1) })),
  (c) => {
    const st = stateFromContext(c);
    const body = c.req.valid('json');
    try {
      const res = st.engine.constructBuilding(body.type as any);
      return c.json(res);
    } catch (e: any) {
      return jsonError(c, 500, String(e?.message ?? e));
    }
  }
);


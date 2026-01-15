import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { jsonError } from './_shared.js';
import { stateFromContext } from '../core/state.js';

export const dayRouter = new Hono();

dayRouter.post('/day/tick', zValidator('json', z.object({}).passthrough()), (c) => {
  const st = stateFromContext(c);
  try {
    const res = st.engine.dayTick();
    st.questService.processDayEnd();
    return c.json(res);
  } catch (e: any) {
    return jsonError(c, 500, String(e?.message ?? e));
  }
});


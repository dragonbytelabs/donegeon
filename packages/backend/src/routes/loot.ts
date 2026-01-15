import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { jsonError } from './_shared.js';
import { stateFromContext } from '../core/state.js';

export const lootRouter = new Hono();

lootRouter.get('/loot', (c) => {
  const st = stateFromContext(c);
  return c.json(st.lootRepo.get());
});

lootRouter.post(
  '/loot/collect',
  zValidator('json', z.object({ loot_type: z.string().min(1), amount: z.number().int() })),
  (c) => {
    const st = stateFromContext(c);
    const body = c.req.valid('json');
    const type = body.loot_type as any;
    if (!['coin', 'paper', 'ink', 'gear', 'parts', 'blueprint_shard'].includes(type)) {
      return jsonError(c, 400, 'invalid loot_type');
    }
    st.lootRepo.add([{ type, amount: body.amount }]);
    return c.json(st.lootRepo.get());
  }
);


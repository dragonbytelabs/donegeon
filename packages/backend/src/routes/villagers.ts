import { Hono } from 'hono';
import { stateFromContext } from '../core/state.js';

export const villagersRouter = new Hono();

villagersRouter.get('/villagers', (c) => {
  const st = stateFromContext(c);
  return c.json(st.villagerRepo.list());
});


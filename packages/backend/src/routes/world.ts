import { Hono } from 'hono';
import { stateFromContext } from '../core/state.js';

export const worldRouter = new Hono();

worldRouter.get('/world', (c) => {
  const st = stateFromContext(c);
  return c.json(st.worldRepo.get());
});


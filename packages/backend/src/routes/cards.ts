import { Hono } from 'hono';
import { jsonError } from './_shared.js';
import { stateFromContext } from '../core/state.js';

export const cardsRouter = new Hono();

cardsRouter.get('/cards', (c) => {
  const st = stateFromContext(c);
  return c.json(st.engine.listCards());
});

cardsRouter.get('/cards/zone/:zone', (c) => {
  const st = stateFromContext(c);
  const zone = c.req.param('zone');
  try {
    return c.json(st.engine.listCardsByZone(zone));
  } catch (e: any) {
    return jsonError(c, 400, String(e?.message ?? e));
  }
});


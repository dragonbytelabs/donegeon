import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { jsonError } from './_shared.js';
import { stateFromContext } from '../core/state.js';
import { deckDefinitions } from '../core/repos/deckRepo.js';

export const decksRouter = new Hono();

decksRouter.get('/decks', (c) => {
  const st = stateFromContext(c);
  const decks = st.deckRepo.list();
  const w = st.worldRepo.get();

  const out = decks.map((d) => {
    let req = 0;
    if (d.type === 'organization') req = st.engine.config.deck_unlock_organization_tasks;
    if (d.type === 'maintenance') req = st.engine.config.deck_unlock_maintenance_tasks;
    if (d.type === 'planning') req = st.engine.config.deck_unlock_planning_tasks;
    if (d.type === 'integration') req = st.engine.config.deck_unlock_integration_tasks;
    return {
      id: d.id,
      type: d.type,
      name: d.name,
      description: d.description,
      status: d.status,
      base_cost: d.base_cost,
      times_opened: d.times_opened,
      unlock_required_tasks: req,
      world_tasks_processed: w.tasks_processed
    };
  });

  return c.json(out);
});

decksRouter.get('/decks/:id/preview', (c) => {
  const st = stateFromContext(c);
  const id = c.req.param('id');
  const d = st.deckRepo.get(id);
  if (!d) return jsonError(c, 404, 'deck not found');
  const def = deckDefinitions[d.type];
  if (!def) return jsonError(c, 500, 'deck definition not found');
  return c.json({
    deck_id: id,
    deck_name: d.name,
    description: d.description,
    base_cost: d.base_cost,
    times_opened: d.times_opened,
    contents: def.contents.map((e) => ({ type: e.type, weight: e.weight }))
  });
});

decksRouter.post('/decks/:id/open', zValidator('json', z.object({}).passthrough()), (c) => {
  const st = stateFromContext(c);
  const id = c.req.param('id');
  try {
    const res = st.engine.openDeck(id);
    return c.json(res);
  } catch (e: any) {
    return jsonError(c, 500, String(e?.message ?? e));
  }
});


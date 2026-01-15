import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { jsonError } from './_shared.js';
import { stateFromContext } from '../core/state.js';

export const recipesRouter = new Hono();

recipesRouter.get('/recipes', (c) => {
  const st = stateFromContext(c);
  return c.json(st.recipeRepo.list());
});

recipesRouter.post(
  '/recipes/craft',
  zValidator('json', z.object({ recipe_id: z.string().min(1) })),
  (c) => {
    const st = stateFromContext(c);
    const body = c.req.valid('json');
    try {
      const res = st.engine.craft(body.recipe_id);
      return c.json(res);
    } catch (e: any) {
      return jsonError(c, 400, String(e?.message ?? e));
    }
  }
);


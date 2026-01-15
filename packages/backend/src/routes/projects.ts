import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { jsonError } from './_shared.js';
import { stateFromContext } from '../core/state.js';

export const projectsRouter = new Hono();

projectsRouter.get('/projects', (c) => {
  const st = stateFromContext(c);
  return c.json(st.projectRepo.list());
});

projectsRouter.post(
  '/projects',
  zValidator('json', z.object({ name: z.string().min(1), description: z.string().optional().default('') })),
  (c) => {
    const st = stateFromContext(c);
    const body = c.req.valid('json');
    const p = st.projectRepo.create(body.name, body.description ?? '');
    return c.json(p);
  }
);

projectsRouter.post('/projects/:id/archive', zValidator('json', z.object({}).passthrough()), (c) => {
  const st = stateFromContext(c);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return jsonError(c, 400, 'invalid project id');
  const p = st.projectRepo.get(id);
  if (!p) return jsonError(c, 404, 'project not found');
  p.archived = true;
  st.projectRepo.update(p);
  return c.json(p);
});


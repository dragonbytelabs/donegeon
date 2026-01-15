import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { jsonError, zTaskId, zVillagerId, zProjectId } from './_shared.js';
import { stateFromContext } from '../core/state.js';

export const tasksRouter = new Hono();

tasksRouter.get('/tasks', (c) => {
  const st = stateFromContext(c);
  return c.json(st.taskRepo.list());
});

tasksRouter.post(
  '/tasks',
  zValidator(
    'json',
    z.object({
      name: z.string().min(1),
      description: z.string().optional().default('')
    })
  ),
  (c) => {
    const st = stateFromContext(c);
    const body = c.req.valid('json');
    const t = st.taskRepo.create(body.name, body.description ?? '');
    st.questService.refreshProgress();
    return c.json(t);
  }
);

tasksRouter.post(
  '/tasks/tag',
  zValidator('json', z.object({ id: zTaskId, tag: z.string().min(1) })),
  (c) => {
    const st = stateFromContext(c);
    const body = c.req.valid('json');
    const { ok, task } = st.taskRepo.addTag(body.id, body.tag);
    if (!ok || !task) return jsonError(c, 404, 'task not found');
    st.questService.refreshProgress();
    return c.json(task);
  }
);

tasksRouter.post(
  '/tasks/priority',
  zValidator('json', z.object({ id: zTaskId, priority: z.number().int().min(0).max(4) })),
  (c) => {
    const st = stateFromContext(c);
    const body = c.req.valid('json');
    const { ok, task } = st.taskRepo.setPriority(body.id, body.priority as any);
    if (!ok || !task) return jsonError(c, 404, 'task not found');
    st.questService.refreshProgress();
    return c.json(task);
  }
);

tasksRouter.post('/tasks/complete', zValidator('json', z.object({ id: zTaskId })), (c) => {
  const st = stateFromContext(c);
  const body = c.req.valid('json');
  try {
    const res = st.engine.completeTask(body.id);
    st.questService.refreshProgress();
    return c.json(res);
  } catch (e: any) {
    return jsonError(c, 500, String(e?.message ?? e));
  }
});

tasksRouter.post('/tasks/move-to-live', zValidator('json', z.object({ id: zTaskId })), (c) => {
  const st = stateFromContext(c);
  const body = c.req.valid('json');
  const { ok, task } = st.taskRepo.processToLive(body.id);
  if (!ok || !task) return jsonError(c, 404, 'task not found');
  st.engine.trackTaskProcessed();
  st.questService.refreshProgress();
  return c.json(task);
});

tasksRouter.post(
  '/tasks/process',
  zValidator(
    'json',
    z.object({
      task_id: zTaskId,
      villager_id: zVillagerId,
      hours_worked: z.number().positive().optional()
    })
  ),
  (c) => {
    const st = stateFromContext(c);
    const body = c.req.valid('json');

    const hoursWorked = body.hours_worked && body.hours_worked > 0 ? body.hours_worked : 1;

    const t = st.taskRepo.get(body.task_id);
    if (!t) return jsonError(c, 404, 'task not found');

    const v = st.villagerRepo.get(body.villager_id);
    if (!v) return jsonError(c, 404, 'villager not found');

    if (v.stamina <= 0) return jsonError(c, 400, 'villager has no stamina');

    const wasInbox = t.zone === 'inbox';
    if (wasInbox) {
      st.taskRepo.processToLive(t.id);
      st.engine.trackTaskProcessed();
    }

    st.taskRepo.startWork(t);
    const isComplete = st.taskRepo.addWorkProgress(t, v.speed, hoursWorked);

    v.stamina -= 1;
    st.villagerRepo.update(v);

    if (isComplete) {
      try {
        st.engine.completeTask(t.id);
        st.questService.refreshProgress();
      } catch (e: any) {
        return jsonError(c, 500, `failed to complete task: ${String(e?.message ?? e)}`);
      }
    } else {
      st.taskRepo.update(t);
    }

    return c.json({ status: 'processed', task: st.taskRepo.get(t.id), villager: v });
  }
);

tasksRouter.post(
  '/tasks/set-project',
  zValidator('json', z.object({ task_id: zTaskId, project_id: zProjectId.nullable() })),
  (c) => {
    const st = stateFromContext(c);
    const body = c.req.valid('json');
    const t = st.taskRepo.get(body.task_id);
    if (!t) return jsonError(c, 404, 'task not found');
    if (body.project_id != null) {
      const proj = st.projectRepo.get(body.project_id);
      if (!proj) return jsonError(c, 404, 'project not found');
    }
    t.project_id = body.project_id ?? null;
    st.taskRepo.update(t);
    return c.json(t);
  }
);

tasksRouter.post(
  '/tasks/reorder',
  zValidator('json', z.object({ source_id: zTaskId, target_id: zTaskId })),
  (c) => {
    const st = stateFromContext(c);
    const body = c.req.valid('json');
    st.taskRepo.reorder(body.source_id, body.target_id);
    return c.json({ status: 'ok' });
  }
);

tasksRouter.get('/tasks/inbox', (c) => {
  const st = stateFromContext(c);
  return c.json(st.taskRepo.listByZone('inbox'));
});

tasksRouter.get('/tasks/live', (c) => {
  const st = stateFromContext(c);
  return c.json(st.taskRepo.listByZone('live'));
});

tasksRouter.get('/tasks/completed', (c) => {
  const st = stateFromContext(c);
  return c.json(st.taskRepo.listByZone('completed'));
});

tasksRouter.get('/tasks/:id/modifiers', (c) => {
  const st = stateFromContext(c);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return jsonError(c, 400, 'invalid task id');
  const t = st.taskRepo.get(id);
  if (!t) return jsonError(c, 404, 'task not found');
  const mods = t.modifier_ids.map((mid) => st.modifierRepo.get(mid)).filter(Boolean);
  return c.json(mods);
});

// Board stacking: assign villager to task
tasksRouter.post(
  '/tasks/assign',
  zValidator('json', z.object({ task_id: zTaskId, villager_id: zVillagerId })),
  (c) => {
    const st = stateFromContext(c);
    const body = c.req.valid('json');

    const v = st.villagerRepo.get(body.villager_id);
    if (!v) return jsonError(c, 404, 'villager not found');

    const t = st.taskRepo.get(body.task_id);
    if (!t) return jsonError(c, 404, 'task not found');

    // stamina cost based on tags
    let staminaCost = 1;
    for (const tag of t.tags) {
      if (tag === 'deep_work') staminaCost = 3;
      if (tag === 'meeting') staminaCost = 2;
    }
    if (v.stamina < staminaCost) return jsonError(c, 400, 'villager has insufficient stamina');

    v.stamina -= staminaCost;
    st.villagerRepo.update(v);

    t.assigned_villager = v.id;
    if (t.zone !== 'live') st.taskRepo.processToLive(t.id);
    st.taskRepo.update(t);

    return c.json(t);
  }
);


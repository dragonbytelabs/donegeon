import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { jsonError } from './_shared.js';
import { stateFromContext } from '../core/state.js';
import type { ModifierCardModel, ModifierType } from '../core/types.js';

export const modifiersRouter = new Hono();

modifiersRouter.get('/modifiers', (c) => {
  const st = stateFromContext(c);
  return c.json(st.modifierRepo.list());
});

// Attach modifier to a task (create + attach) — Go: POST /api/tasks/modifiers/add
modifiersRouter.post(
  '/tasks/modifiers/add',
  zValidator(
    'json',
    z.object({
      task_id: z.number().int().positive(),
      type: z.string().min(1),
      deadline_at: z.string().optional(),
      every_days: z.number().int().optional(),
      next_at: z.string().optional(),
      charges: z.number().int().optional()
    })
  ),
  (c) => {
    const st = stateFromContext(c);
    const body = c.req.valid('json');
    const now = st.clock.now();

    const type = body.type as ModifierType;
    const card: ModifierCardModel = {
      id: `m_${body.task_id}_${now.getTime()}`,
      type,
      created_at: now.toISOString(),
      status: 'active',
      max_charges: 0,
      charges: 0
    };

    if (type === 'deadline_pin') {
      if (!body.deadline_at) return jsonError(c, 400, 'deadline_at is required for deadline_pin');
      card.deadline_at = new Date(body.deadline_at).toISOString();
    } else if (type === 'importance_seal') {
      card.max_charges = 3;
      card.charges = 3;
    } else if (type === 'schedule_token') {
      card.max_charges = 2;
      card.charges = 2;
      if (body.deadline_at) card.scheduled_at = new Date(body.deadline_at).toISOString();
    } else if (type === 'recurring_contract') {
      if (!body.every_days || body.every_days <= 0) return jsonError(c, 400, 'every_days is required for recurring_contract');
      card.recurring_every_days = body.every_days;
      const max = body.charges && body.charges > 0 ? body.charges : 4;
      card.max_charges = max;
      card.charges = max;
      card.recurring_next_at = body.next_at ? new Date(body.next_at).toISOString() : new Date(now.getTime() + body.every_days * 86400000).toISOString();
    } else {
      // allow other types with defaults
    }

    try {
      const res = st.engine.attachModifier(body.task_id, card);
      return c.json(res);
    } catch (e: any) {
      return jsonError(c, 400, String(e?.message ?? e));
    }
  }
);

modifiersRouter.post(
  '/tasks/modifiers/remove',
  zValidator('json', z.object({ task_id: z.number().int().positive(), modifier_id: z.string().min(1) })),
  (c) => {
    const st = stateFromContext(c);
    const body = c.req.valid('json');
    try {
      const res = st.engine.detachModifier(body.task_id, body.modifier_id);
      return c.json(res);
    } catch (e: any) {
      return jsonError(c, 400, String(e?.message ?? e));
    }
  }
);

// Attach existing modifier card to task — Go: POST /api/tasks/modifiers/attach
modifiersRouter.post(
  '/tasks/modifiers/attach',
  zValidator('json', z.object({ task_id: z.number().int().positive(), modifier: z.any() })),
  (c) => {
    const st = stateFromContext(c);
    const body = c.req.valid('json');
    try {
      const res = st.engine.attachModifier(body.task_id, body.modifier as ModifierCardModel);
      return c.json(res);
    } catch (e: any) {
      return jsonError(c, 400, String(e?.message ?? e));
    }
  }
);

// Modifier-specific updates
modifiersRouter.post(
  '/modifiers/waiting-on/set',
  zValidator('json', z.object({ modifier_id: z.string().min(1), unblocked_at: z.string().min(1) })),
  (c) => {
    const st = stateFromContext(c);
    const body = c.req.valid('json');
    const mod = st.modifierRepo.get(body.modifier_id);
    if (!mod) return jsonError(c, 404, 'modifier not found');
    mod.unblocked_at = new Date(body.unblocked_at).toISOString();
    st.modifierRepo.update(mod);
    return c.json(mod);
  }
);

modifiersRouter.post(
  '/modifiers/checklist/increment',
  zValidator('json', z.object({ modifier_id: z.string().min(1) })),
  (c) => {
    const st = stateFromContext(c);
    const body = c.req.valid('json');
    const mod = st.modifierRepo.get(body.modifier_id);
    if (!mod) return jsonError(c, 404, 'modifier not found');
    if (typeof mod.checklist_total === 'number') {
      mod.checklist_completed = Math.min(mod.checklist_total, (mod.checklist_completed ?? 0) + 1);
    }
    st.modifierRepo.update(mod);
    return c.json(mod);
  }
);

modifiersRouter.post(
  '/modifiers/review/set',
  zValidator(
    'json',
    z.object({
      modifier_id: z.string().min(1),
      review_every_days: z.number().int().positive(),
      review_next_at: z.string().min(1)
    })
  ),
  (c) => {
    const st = stateFromContext(c);
    const body = c.req.valid('json');
    const mod = st.modifierRepo.get(body.modifier_id);
    if (!mod) return jsonError(c, 404, 'modifier not found');
    mod.review_every_days = body.review_every_days;
    mod.review_next_at = new Date(body.review_next_at).toISOString();
    st.modifierRepo.update(mod);
    return c.json(mod);
  }
);


import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { jsonError } from './_shared.js';
import { stateFromContext } from '../core/state.js';

export const questsRouter = new Hono();

questsRouter.get('/quests', (c) => {
  const st = stateFromContext(c);
  return c.json(st.questRepo.list());
});

questsRouter.get('/quests/active', (c) => {
  const st = stateFromContext(c);
  return c.json(st.questService.getActiveQuests());
});

questsRouter.get('/quests/daily', (c) => {
  const st = stateFromContext(c);
  return c.json(st.questRepo.listByType('daily'));
});

questsRouter.post('/quests/:id/complete', zValidator('json', z.object({}).passthrough()), (c) => {
  const st = stateFromContext(c);
  const id = c.req.param('id');
  const q = st.questRepo.get(id);
  if (!q) return jsonError(c, 404, 'quest not found');
  const res = st.questService.claimRewards(id);
  if (!res.ok) return jsonError(c, 404, 'quest not found');
  st.questService.unlockNextStoryQuest();
  return c.json({ rewards: res.rewards, events: [{ kind: 'quest_completed', quest_id: id, title: q.title }] });
});

questsRouter.post('/quests/refresh', zValidator('json', z.object({}).passthrough()), (c) => {
  const st = stateFromContext(c);
  const result = st.questService.refreshProgress();
  return c.json({ status: 'ok', events: result.events });
});


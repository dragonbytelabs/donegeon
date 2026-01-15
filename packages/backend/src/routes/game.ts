import { Hono } from 'hono';
import { stateFromContext } from '../core/state.js';

export const gameRouter = new Hono();

gameRouter.get('/game/state', (c) => {
  // In Go, this is engine.GameState.Get(); here we return a minimal snapshot.
  const st = stateFromContext(c);
  return c.json({
    world: st.worldRepo.get(),
    tasks: st.taskRepo.list(),
    villagers: st.villagerRepo.list(),
    zombies: st.zombieRepo.list()
  });
});

gameRouter.get('/game/remaining-undrawn', (c) => {
  // Placeholder: no undrawn tracking; return 0 for now.
  return c.json({ remaining_undrawn: 0 });
});

gameRouter.get('/today', (c) => {
  const st = stateFromContext(c);
  return c.json(st.engine.todaySummary());
});


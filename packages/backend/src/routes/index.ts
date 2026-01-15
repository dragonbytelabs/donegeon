import { Hono } from 'hono';
import { tasksRouter } from './tasks.js';
import { questsRouter } from './quests.js';
import { recipesRouter } from './recipes.js';
import { villagersRouter } from './villagers.js';
import { zombiesRouter } from './zombies.js';
import { worldRouter } from './world.js';
import { dayRouter } from './day.js';
import { modifiersRouter } from './modifiers.js';
import { lootRouter } from './loot.js';
import { decksRouter } from './decks.js';
import { buildingsRouter } from './buildings.js';
import { projectsRouter } from './projects.js';
import { gameRouter } from './game.js';
import { cardsRouter } from './cards.js';
import { devRouter } from './dev.js';
import { progressRouter } from './progress.js';
import { boardRouter } from './board/index.js';

export const apiRouter = new Hono();

apiRouter.route('/', tasksRouter);
apiRouter.route('/', questsRouter);
apiRouter.route('/', recipesRouter);
apiRouter.route('/', progressRouter);
apiRouter.route('/', villagersRouter);
apiRouter.route('/', zombiesRouter);
apiRouter.route('/', worldRouter);
apiRouter.route('/', dayRouter);
apiRouter.route('/', modifiersRouter);
apiRouter.route('/', lootRouter);
apiRouter.route('/', decksRouter);
apiRouter.route('/', buildingsRouter);
apiRouter.route('/', projectsRouter);
apiRouter.route('/', gameRouter);
apiRouter.route('/', cardsRouter);
apiRouter.route('/', devRouter);
apiRouter.route('/', boardRouter);


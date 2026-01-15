import type { Context } from 'hono';
import type { Clock } from './clock.js';
import * as clockMod from './clock.js';
import { Engine } from './engine.js';
import type { Rng } from './rng.js';
import { mulberry32, systemRng } from './rng.js';
import { BuildingRepo } from './repos/buildingRepo.js';
import { CardRepo } from './repos/cardRepo.js';
import { DeckRepo } from './repos/deckRepo.js';
import { LootRepo } from './repos/lootRepo.js';
import { ModifierRepo } from './repos/modifierRepo.js';
import { ProjectRepo } from './repos/projectRepo.js';
import { QuestRepo } from './repos/questRepo.js';
import { RecipeRepo } from './repos/recipeRepo.js';
import { TaskRepo } from './repos/taskRepo.js';
import { VillagerRepo } from './repos/villagerRepo.js';
import { WorldRepo } from './repos/worldRepo.js';
import { ZombieRepo } from './repos/zombieRepo.js';
import { BoardRepo } from './repos/boardRepo.js';
import { QuestService } from './questService.js';
import type { BuildingModel, DeckModel, ProjectModel, QuestModel, RecipeModel, VillagerModel, WorldModel } from './types.js';

export interface AppState {
  clock: Clock;
  rng: Rng;

  taskRepo: TaskRepo;
  questRepo: QuestRepo;
  questService: QuestService;
  recipeRepo: RecipeRepo;
  villagerRepo: VillagerRepo;
  zombieRepo: ZombieRepo;
  worldRepo: WorldRepo;
  modifierRepo: ModifierRepo;
  lootRepo: LootRepo;
  deckRepo: DeckRepo;
  buildingRepo: BuildingRepo;
  projectRepo: ProjectRepo;
  cardRepo: CardRepo;
  boardRepo: BoardRepo;

  engine: Engine;
}

let singleton: AppState | undefined;
let testOverrides: { seed?: number; start?: Date } | undefined;

function seedVillagers(): VillagerModel[] {
  return [
    { id: 'v1', name: 'Ada', stamina: 3, max_stamina: 3, speed: 1, level: 1, tired: false },
    { id: 'v2', name: 'Linus', stamina: 3, max_stamina: 3, speed: 1, level: 1, tired: false }
  ];
}

function seedWorld(): WorldModel {
  return { day_index: 1, tasks_processed: 0, overrun_level: 0, loot_penalty_pct: 0, pack_cost_pct: 0 };
}

function seedDecks(): DeckModel[] {
  return [
    {
      id: 'deck_first_day',
      type: 'first_day',
      name: 'First Day Deck',
      description: 'Bootstrap new players with starting tasks / small rewards',
      status: 'unlocked',
      base_cost: 0,
      times_opened: 0
    },
    {
      id: 'deck_organization',
      type: 'organization',
      name: 'Organization Deck',
      description: 'Workflow modifiers to structure work',
      status: 'locked',
      base_cost: 2,
      times_opened: 0
    },
    {
      id: 'deck_maintenance',
      type: 'maintenance',
      name: 'Maintenance Deck',
      description: 'Upkeep and blocker handling',
      status: 'locked',
      base_cost: 3,
      times_opened: 0
    },
    {
      id: 'deck_planning',
      type: 'planning',
      name: 'Planning Deck',
      description: 'Project planning, breaking down work',
      status: 'locked',
      base_cost: 4,
      times_opened: 0
    },
    {
      id: 'deck_integration',
      type: 'integration',
      name: 'Integration Deck',
      description: 'Advanced materials and high-tier rewards',
      status: 'locked',
      base_cost: 6,
      times_opened: 0
    }
  ];
}

function seedBuildings(): BuildingModel[] {
  return [
    { type: 'rest_hall', name: 'Rest Hall', description: 'Restores stamina', status: 'available' },
    { type: 'farm', name: 'Farm', description: 'Improves food output', status: 'available' },
    { type: 'workshop', name: 'Workshop', description: 'Craft advanced modifiers', status: 'available' },
    { type: 'library', name: 'Library', description: 'Unlocks knowledge tools', status: 'available' }
  ];
}

function seedProjects(): ProjectModel[] {
  return [];
}

function seedRecipes(): RecipeModel[] {
  return [{ id: 'r_make_omelet', name: 'Make Omelet', description: 'A simple recipe placeholder' }];
}

function seedQuests(): QuestModel[] {
  return [
    {
      id: 'q_daily_create_task',
      title: 'Create a task',
      description: 'Create any task today.',
      type: 'daily',
      status: 'active',
      rewards: [{ kind: 'roll_table', tableId: 'daily_small' }]
    }
  ];
}

export function getAppState(): AppState {
  if (singleton) return singleton;

  const clock: Clock =
    testOverrides?.start || testOverrides?.seed != null
      ? new clockMod.MutableClock(testOverrides?.start ?? new Date('2026-01-01T00:00:00.000Z'))
      : clockMod.systemClock;
  const rng: Rng = testOverrides?.seed != null ? mulberry32(testOverrides.seed) : systemRng;

  const taskRepo = new TaskRepo(clock);
  const questRepo = new QuestRepo();
  const recipeRepo = new RecipeRepo();
  const villagerRepo = new VillagerRepo();
  const zombieRepo = new ZombieRepo();
  const worldRepo = new WorldRepo(seedWorld());
  const modifierRepo = new ModifierRepo();
  const lootRepo = new LootRepo({ coin: 5 });
  const deckRepo = new DeckRepo();
  const buildingRepo = new BuildingRepo();
  const projectRepo = new ProjectRepo();
  const cardRepo = new CardRepo();
  const boardRepo = new BoardRepo();

  questRepo.seed(seedQuests());
  recipeRepo.seed(seedRecipes());
  villagerRepo.seed(seedVillagers());
  deckRepo.seed(seedDecks());
  buildingRepo.seed(seedBuildings());
  projectRepo.seed(seedProjects());

  const questService = new QuestService(taskRepo, questRepo);

  const engine = new Engine(
    clock,
    rng,
    taskRepo,
    questRepo,
    recipeRepo,
    villagerRepo,
    zombieRepo,
    worldRepo,
    modifierRepo,
    lootRepo,
    deckRepo,
    buildingRepo,
    projectRepo,
    cardRepo
  );

  singleton = {
    clock,
    rng,
    taskRepo,
    questRepo,
    questService,
    recipeRepo,
    villagerRepo,
    zombieRepo,
    worldRepo,
    modifierRepo,
    lootRepo,
    deckRepo,
    buildingRepo,
    projectRepo,
    cardRepo,
    boardRepo,
    engine
  };

  return singleton;
}

// Testing helper: reset singleton state so smoke tests can run from a clean slate.
export function resetAppStateForTests() {
  singleton = undefined;
  testOverrides = undefined;
}

export function configureAppStateForTests(opts: { seed: number; start: Date }) {
  testOverrides = { ...opts };
  singleton = undefined;
}

export function attachStateToContext(c: Context) {
  c.set('state', getAppState());
}

export function stateFromContext(c: Context): AppState {
  return c.get('state') as AppState;
}


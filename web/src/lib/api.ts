import type {
  Task,
  ModifierCard,
  Recipe,
  Villager,
  Zombie,
  World,
  DayTickResult,
  TodaySummary,
  ClearZombieResult,
  ModifierType,
  Inventory,
  Deck,
  OpenDeckResult,
  Building,
  CompleteTaskResult,
  Project,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export const api = {
  // tasks
  listTasks: () => request<Task[]>("/api/tasks"),
  listInbox: () => request<Task[]>("/api/tasks/inbox"),
  listLive: () => request<Task[]>("/api/tasks/live"),
  listCompleted: () => request<Task[]>("/api/tasks/completed"),

  createTask: (name: string, description: string) =>
    request<Task>("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    }),

  addTag: (id: number, tag: string) =>
    request<Task>("/api/tasks/tag", {
      method: "POST",
      body: JSON.stringify({ id, tag }),
    }),

  completeTask: (id: number) =>
    request<CompleteTaskResult>("/api/tasks/complete", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),

  reorderTask: (source_id: number, target_id: number) =>
    request<{ status: string }>("/api/tasks/reorder", {
      method: "POST",
      body: JSON.stringify({ source_id, target_id }),
    }),

  processTask: (task_id: number, villager_id: string) =>
    request<{ status: string; task: Task; villager: Villager }>("/api/tasks/process", {
      method: "POST",
      body: JSON.stringify({ task_id, villager_id }),
    }),

  moveTaskToLive: (id: number) =>
    request<Task>("/api/tasks/move-to-live", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),

  setTaskProject: (task_id: number, project_id: number | null) =>
    request<Task>("/api/tasks/set-project", {
      method: "POST",
      body: JSON.stringify({ task_id, project_id }),
    }),

  taskModifiers: (id: number) =>
    request<ModifierCard[]>(`/api/tasks/${id}/modifiers`),

  // modifiers attach/detach
  addModifier: (args: {
    task_id: number;
    type: ModifierType;
    deadline_at?: string;
    every_days?: number;
    next_at?: string;
    charges?: number;
  }) =>
    request<any>("/api/tasks/modifiers/add", {
      method: "POST",
      body: JSON.stringify(args),
    }),

  removeModifier: (task_id: number, modifier_id: string) =>
    request<Task>("/api/tasks/modifiers/remove", {
      method: "POST",
      body: JSON.stringify({ task_id, modifier_id }),
    }),

  listModifiers: () => request<ModifierCard[]>("/api/modifiers"),

  // quests
  listQuests: () => request<any[]>("/api/quests"),
  listActiveQuests: () => request<any[]>("/api/quests/active"),
  listDailyQuests: () => request<any[]>("/api/quests/daily"),
  completeQuest: (quest_id: string) =>
    request<any>(`/api/quests/${quest_id}/complete`, {
      method: "POST",
      body: "{}",
    }),
  refreshQuests: () =>
    request<any>("/api/quests/refresh", {
      method: "POST",
      body: "{}",
    }),
  
  // recipes
  listRecipes: () => request<Recipe[]>("/api/recipes"),
  craft: (recipe_id: string) =>
    request<any>("/api/recipes/craft", {
      method: "POST",
      body: JSON.stringify({ recipe_id }),
    }),

  progress: () =>
    request<{ ok: boolean }>("/api/progress", { method: "POST", body: "{}" }),

  // world
  world: () => request<World>("/api/world"),
  villagers: () => request<Villager[]>("/api/villagers"),
  zombies: () => request<Zombie[]>("/api/zombies"),

  dayTick: () =>
    request<DayTickResult>("/api/day/tick", { method: "POST", body: "{}" }),

  clearZombie: (zombie_id: string, slots: 1 | 2) =>
    request<ClearZombieResult>("/api/zombies/clear", {
      method: "POST",
      body: JSON.stringify({ zombie_id, slots }),
    }),

  // loot
  loot: () => request<Inventory>("/api/loot"),
  collectLoot: (loot_type: string, amount: number) =>
    request<Inventory>("/api/loot/collect", {
      method: "POST",
      body: JSON.stringify({ loot_type, amount }),
    }),

  // today summary
  today: () => request<TodaySummary>("/api/today"),

  // decks
  listDecks: () => request<Deck[]>("/api/decks"),
  openDeck: (deck_id: string) =>
    request<OpenDeckResult>(`/api/decks/${deck_id}/open`, {
      method: "POST",
    }),

  // buildings
  listBuildings: () => request<Building[]>("/api/buildings"),
  constructBuilding: (type: string) =>
    request<Building>("/api/buildings/construct", {
      method: "POST",
      body: JSON.stringify({ type }),
    }),

  // stacking actions
  assignTask: (task_id: number, villager_id: string) =>
    request<Task>("/api/tasks/assign", {
      method: "POST",
      body: JSON.stringify({ task_id, villager_id }),
    }),

  attachModifier: (task_id: number, modifier: ModifierCard) =>
    request<Task>("/api/tasks/modifiers/attach", {
      method: "POST",
      body: JSON.stringify({ task_id, modifier }),
    }),

  executeRecipe: (task_id_1: number, task_id_2: number) =>
    request<any>("/api/recipes/execute", {
      method: "POST",
      body: JSON.stringify({ task_id_1, task_id_2 }),
    }),

  // projects
  listProjects: () => request<Project[]>("/api/projects"),
  
  createProject: (name: string, description: string) =>
    request<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    }),

  archiveProject: (id: number) =>
    request<Project>(`/api/projects/${id}/archive`, {
      method: "POST",
    }),
};

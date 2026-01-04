import type {
  Task,
  ModifierCard,
  Quest,
  Recipe,
  Villager,
  Zombie,
  World,
  DayTickResult,
  ClearZombieResult,
  ModifierType,
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
    request<Task>("/api/tasks/complete", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),

  processTask: (id: number) =>
    request<Task>("/api/tasks/process", {
      method: "POST",
      body: JSON.stringify({ id }),
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

  // quests/recipes
  listQuests: () => request<Quest[]>("/api/quests"),
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
};

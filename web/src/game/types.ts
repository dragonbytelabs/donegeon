import type { Task } from "../lib/types";

export type GameCardModel = {
  id: string;          // stable string id for UI
  taskId: number;      // link back to Task
  title: string;
  subtitle?: string;
  description?: string;

  // future: position/rotation for canvas
  x?: number;
  y?: number;
  rot?: number;
};

export function taskToGameCard(t: Task): GameCardModel {
  return {
    id: `task:${t.id}`,
    taskId: t.id,
    title: t.name,
    subtitle: `#${t.id}`,
    description: t.description || "",
  };
}

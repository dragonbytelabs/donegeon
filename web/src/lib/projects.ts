import type { Task } from "./types";

const PREFIX = "project:";

export function getProjectNameFromTag(tag: string): string | null {
  if (!tag.startsWith(PREFIX)) return null;
  const name = tag.slice(PREFIX.length).trim();
  return name ? name : null;
}

export function listProjects(tasks: Task[]): string[] {
  const set = new Set<string>();
  for (const t of tasks) {
    for (const tag of t.tags || []) {
      const p = getProjectNameFromTag(tag);
      if (p) set.add(p);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function groupTasksByProject(tasks: Task[]): Record<string, Task[]> {
  const map: Record<string, Task[]> = {};

  for (const t of tasks) {
    const projects = (t.tags || [])
      .map(getProjectNameFromTag)
      .filter((x): x is string => Boolean(x));

    const key = projects[0] ?? "(no project)";
    map[key] ??= [];
    map[key].push(t);
  }

  // stable-ish
  for (const k of Object.keys(map)) {
    map[k].sort((a, b) => a.id - b.id);
  }

  return map;
}

import type { Clock } from '../clock.js';
import type { TaskModel, TaskPriority, TaskZone } from '../types.js';

export class TaskRepo {
  private byId = new Map<number, TaskModel>();
  private nextId = 1;

  constructor(private clock: Clock) {}

  seed(tasks: TaskModel[]) {
    for (const t of tasks) {
      this.byId.set(t.id, t);
      this.nextId = Math.max(this.nextId, t.id + 1);
    }
  }

  list(): TaskModel[] {
    return [...this.byId.values()].sort((a, b) => a.id - b.id);
  }

  listByZone(zone: TaskZone): TaskModel[] {
    return this.list().filter((t) => t.zone === zone);
  }

  get(id: number): TaskModel | undefined {
    return this.byId.get(id);
  }

  create(name: string, description: string): TaskModel {
    const id = this.nextId++;
    const t: TaskModel = {
      id,
      name,
      description,
      zone: 'inbox',
      completed: false,
      tags: [],
      priority: 0,
      work_progress: 0,
      work_time_hours: 1,
      worked_today: false,
      modifier_ids: [],
      project_id: null
    };
    this.byId.set(id, t);
    return t;
  }

  update(task: TaskModel): TaskModel {
    this.byId.set(task.id, task);
    return task;
  }

  addTag(id: number, tag: string): { task?: TaskModel; ok: boolean } {
    const t = this.byId.get(id);
    if (!t) return { ok: false };
    if (tag && !t.tags.includes(tag)) t.tags = [...t.tags, tag];
    this.update(t);
    return { ok: true, task: t };
  }

  setPriority(id: number, priority: TaskPriority): { task?: TaskModel; ok: boolean } {
    const t = this.byId.get(id);
    if (!t) return { ok: false };
    t.priority = priority;
    this.update(t);
    return { ok: true, task: t };
  }

  processToLive(id: number): { task?: TaskModel; ok: boolean } {
    const t = this.byId.get(id);
    if (!t) return { ok: false };
    if (t.zone === 'inbox') t.zone = 'live';
    this.update(t);
    return { ok: true, task: t };
  }

  reorder(_sourceId: number, _targetId: number): void {
    // Go impl likely persists order; for in-memory MVP we no-op.
  }

  startWork(t: TaskModel) {
    if (!t.work_started_at) t.work_started_at = this.clock.now().toISOString();
  }

  addWorkProgress(t: TaskModel, speedMultiplier: number, hoursWorked: number): boolean {
    const denom = Math.max(0.25, t.work_time_hours); // prevent div-by-zero
    const delta = (hoursWorked * Math.max(0.25, speedMultiplier)) / denom;
    t.work_progress = Math.max(0, Math.min(1, t.work_progress + delta));
    t.worked_today = true;
    return t.work_progress >= 1;
  }
}


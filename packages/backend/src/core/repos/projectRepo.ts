import type { ProjectModel } from '../types.js';

export class ProjectRepo {
  private byId = new Map<number, ProjectModel>();
  private nextId = 1;

  seed(ps: ProjectModel[]) {
    for (const p of ps) {
      this.byId.set(p.id, p);
      this.nextId = Math.max(this.nextId, p.id + 1);
    }
  }

  list(): ProjectModel[] {
    return [...this.byId.values()].sort((a, b) => a.id - b.id);
  }

  get(id: number): ProjectModel | undefined {
    return this.byId.get(id);
  }

  create(name: string, description: string): ProjectModel {
    const p: ProjectModel = { id: this.nextId++, name, description, archived: false };
    this.byId.set(p.id, p);
    return p;
  }

  update(p: ProjectModel): ProjectModel {
    this.byId.set(p.id, p);
    return p;
  }
}


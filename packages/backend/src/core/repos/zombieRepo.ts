import type { ZombieModel } from '../types.js';

export class ZombieRepo {
  private byId = new Map<string, ZombieModel>();

  seed(zs: ZombieModel[]) {
    for (const z of zs) this.byId.set(z.id, z);
  }

  list(): ZombieModel[] {
    return [...this.byId.values()].sort((a, b) => a.spawned_at.localeCompare(b.spawned_at));
  }

  get(id: string): ZombieModel | undefined {
    return this.byId.get(id);
  }

  add(z: ZombieModel) {
    this.byId.set(z.id, z);
  }

  remove(id: string) {
    this.byId.delete(id);
  }
}


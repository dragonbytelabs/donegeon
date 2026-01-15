import type { VillagerModel } from '../types.js';

export class VillagerRepo {
  private byId = new Map<string, VillagerModel>();

  seed(vs: VillagerModel[]) {
    for (const v of vs) this.byId.set(v.id, v);
  }

  list(): VillagerModel[] {
    return [...this.byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  get(id: string): VillagerModel | undefined {
    return this.byId.get(id);
  }

  update(v: VillagerModel): VillagerModel {
    this.byId.set(v.id, v);
    return v;
  }
}


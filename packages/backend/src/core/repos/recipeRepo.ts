import type { RecipeModel } from '../types.js';

export class RecipeRepo {
  private byId = new Map<string, RecipeModel>();

  seed(rs: RecipeModel[]) {
    for (const r of rs) this.byId.set(r.id, r);
  }

  list(): RecipeModel[] {
    return [...this.byId.values()];
  }

  get(id: string): RecipeModel | undefined {
    return this.byId.get(id);
  }
}


import type { BuildingModel, BuildingType } from '../types.js';

export class BuildingRepo {
  private byType = new Map<BuildingType, BuildingModel>();

  seed(bs: BuildingModel[]) {
    for (const b of bs) this.byType.set(b.type, b);
  }

  list(): BuildingModel[] {
    return [...this.byType.values()];
  }

  get(type: BuildingType): BuildingModel | undefined {
    return this.byType.get(type);
  }

  update(b: BuildingModel): BuildingModel {
    this.byType.set(b.type, b);
    return b;
  }
}


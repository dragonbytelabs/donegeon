import type { InventoryModel, LootDropModel, LootType } from '../types.js';

export class LootRepo {
  private inv: InventoryModel;

  constructor(initial?: Partial<InventoryModel>) {
    this.inv = {
      coin: 0,
      paper: 0,
      ink: 0,
      gear: 0,
      parts: 0,
      blueprint_shard: 0,
      ...(initial ?? {})
    };
  }

  get(): InventoryModel {
    return this.inv;
  }

  add(drops: LootDropModel[]) {
    for (const d of drops) {
      this.addOne(d.type, d.amount);
    }
  }

  addOne(type: LootType, amount: number) {
    this.inv[type] = (this.inv[type] ?? 0) + amount;
  }

  update(inv: InventoryModel) {
    this.inv = inv;
  }
}


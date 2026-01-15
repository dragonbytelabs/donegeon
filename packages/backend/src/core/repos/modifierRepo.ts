import type { ModifierCardModel } from '../types.js';

export class ModifierRepo {
  private byId = new Map<string, ModifierCardModel>();

  list(): ModifierCardModel[] {
    return [...this.byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  get(id: string): ModifierCardModel | undefined {
    return this.byId.get(id);
  }

  create(card: ModifierCardModel): ModifierCardModel {
    this.byId.set(card.id, card);
    return card;
  }

  update(card: ModifierCardModel): ModifierCardModel {
    this.byId.set(card.id, card);
    return card;
  }
}


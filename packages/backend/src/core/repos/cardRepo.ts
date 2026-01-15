import type { CardModel, CardZone } from '../types.js';

export class CardRepo {
  private byId = new Map<string, CardModel>();

  list(): CardModel[] {
    return [...this.byId.values()];
  }

  listByZone(zone: CardZone): CardModel[] {
    return this.list().filter((c) => c.zone === zone);
  }

  upsert(card: CardModel): CardModel {
    this.byId.set(card.id, card);
    return card;
  }
}


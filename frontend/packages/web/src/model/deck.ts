import { uid, CardEntity, type CardDef, type CardDefId, type CardData } from "@cleartify/core";

export class Deck {
  private defs = new Map<CardDefId, CardDef>();

  constructor(initial: CardDef[] = []) {
    for (const d of initial) this.defs.set(d.id, d);
  }

  addDef(def: CardDef) {
    this.defs.set(def.id, def);
  }

  getDef(id: CardDefId) {
    const d = this.defs.get(id);
    if (!d) throw new Error(`Unknown CardDef: ${id}`);
    return d;
  }

  allDefs(): CardDef[] {
    return Array.from(this.defs.values());
  }

  spawn(defId: CardDefId, data: CardData = {}) {
    const def = this.getDef(defId);
    return new CardEntity(uid("card"), def, data);
  }
}

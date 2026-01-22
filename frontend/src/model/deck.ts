import { uid } from "../core/ids";
import { CardEntity } from "./card";
import type { CardDef, CardDefId } from "./types";

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

  spawn(defId: CardDefId, data: Record<string, unknown> = {}) {
    const def = this.getDef(defId);
    return new CardEntity(uid("card"), def, data);
  }
}

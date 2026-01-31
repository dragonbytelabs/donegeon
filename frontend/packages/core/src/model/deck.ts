import { uid } from "../core/ids";
import { assert } from "../core/assert";
import { CardEntity } from "./card";
import type { CardDef, CardDefId } from "./types";

export class Deck<K extends string = string> {
  private defs = new Map<CardDefId, CardDef<K>>();

  constructor(initial: CardDef<K>[] = []) {
    for (const d of initial) this.defs.set(d.id, d);
  }

  addDef(def: CardDef<K>) {
    this.defs.set(def.id, def);
  }

  getDef(id: CardDefId): CardDef<K> {
    const d = this.defs.get(id);
    assert(d, `Deck.getDef: unknown CardDef: ${id}`);
    return d;
  }

  allDefs(): CardDef<K>[] {
    return Array.from(this.defs.values());
  }

  spawn(defId: CardDefId, data: Record<string, unknown> = {}): CardEntity<K> {
    const def = this.getDef(defId);
    return new CardEntity(uid("card"), def, data);
  }
}



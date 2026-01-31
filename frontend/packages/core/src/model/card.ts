import { Entity } from "./entity";
import type { CardData, CardDef, CardId } from "./types";

export class CardEntity<K extends string = string> extends Entity {
  constructor(
    id: CardId,
    public readonly def: CardDef<K>,
    public data: CardData = {}
  ) {
    super(id);
  }

  // convenience helpers
  get title() {
    return this.def.title;
  }
  get icon() {
    return this.def.icon;
  }
  get kind(): K {
    return this.def.kind;
  }
  get skinClass() {
    return this.def.skin;
  }
}



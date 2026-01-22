import { Entity } from "./entity";
import type { CardData, CardDef, CardId } from "./types";

export class CardEntity extends Entity {
  constructor(
    id: CardId,
    public readonly def: CardDef,
    public data: CardData = {},
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
  get kind() {
    return this.def.kind;
  }
  get skinClass() {
    return this.def.skinClass;
  }
}

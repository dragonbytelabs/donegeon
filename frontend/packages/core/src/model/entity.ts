import type { EntityId } from "../core/ids";

export abstract class Entity {
  constructor(public readonly id: EntityId) {}
}



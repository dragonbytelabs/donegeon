import type { WorldModel } from '../types.js';

export class WorldRepo {
  private world: WorldModel;

  constructor(initial: WorldModel) {
    this.world = initial;
  }

  get(): WorldModel {
    return this.world;
  }

  update(next: WorldModel): WorldModel {
    this.world = next;
    return this.world;
  }
}


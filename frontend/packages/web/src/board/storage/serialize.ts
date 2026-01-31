import type { Engine } from "@donegeon/core";
import type { BoardSnapshot, SerializedStack } from "./schema";

export function serializeEngine(engine: Engine, boardId: string): BoardSnapshot {
  const stacks: SerializedStack[] = [];

  for (const [id, stack] of engine.stacks) {
    stacks.push({
      id,
      pos: { ...stack.pos[0]() },
      z: stack.z[0](),
      cards: stack.cards[0]().map((card) => ({
        id: card.id,
        defId: card.def.id,
        data: { ...card.data },
      })),
    });
  }

  return {
    id: boardId,
    version: 1,
    timestamp: Date.now(),
    stacks,
    maxZ: engine.getMaxZ(),
  };
}

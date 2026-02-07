import { CardEntity, StackEntity, type Engine } from "@donegeon/core";
import { resolveCardDef } from "../../model/catalog";
import type { BoardSnapshot } from "./schema";

export function hydrateEngine(engine: Engine, snapshot: BoardSnapshot): void {
  // Restore maxZ counter
  engine.setMaxZ(snapshot.maxZ);

  // Restore stacks
  for (const stackData of snapshot.stacks) {
    const cards = stackData.cards.map((c) => {
      const def = resolveCardDef(c.defId, c.data ?? {});
      return new CardEntity(c.id, def, c.data);
    });

    const stack = new StackEntity(stackData.id, stackData.pos, cards);
    stack.z[1](stackData.z);
    engine.addStack(stack);
  }
}

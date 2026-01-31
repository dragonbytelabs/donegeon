import { CardEntity, StackEntity, type Engine } from "@donegeon/core";
import { donegeonDefs, type DonegeonDefId } from "../../model/catalog";
import type { BoardSnapshot } from "./schema";

export function hydrateEngine(engine: Engine, snapshot: BoardSnapshot): void {
  // Restore maxZ counter
  engine.setMaxZ(snapshot.maxZ);

  // Restore stacks
  for (const stackData of snapshot.stacks) {
    const cards = stackData.cards.map((c) => {
      const def = donegeonDefs[c.defId as DonegeonDefId];
      return new CardEntity(c.id, def ?? donegeonDefs["task.blank"], c.data);
    });

    const stack = new StackEntity(stackData.id, stackData.pos, cards);
    stack.z[1](stackData.z);
    engine.addStack(stack);
  }
}

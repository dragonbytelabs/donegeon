import { produce } from "immer";
import type { Engine } from "@donegeon/core";
import { CardEntity } from "@donegeon/core";

/**
 * Update a card by replacing the CardEntity instance (since card.def is readonly).
 * - nextDef: optional new def
 * - recipe: optional Immer recipe that mutates draft data
 *
 * IMPORTANT:
 * - We do NOT immer-produce() the cards array because it contains class instances.
 * - We instead create a new array via slice() and replace one index.
 */
export function updateCard(
  engine: Engine,
  stackId: string,
  cardId: string,
  opts: {
    nextDef?: any;
    recipe?: (draftData: any) => void;
  }
): CardEntity | null {
  const s = engine.getStack(stackId);
  if (!s) return null;

  const cards = s.cards[0]();
  const i = cards.findIndex((c: any) => c?.id === cardId);
  if (i < 0) return null;

  const cur = cards[i] as any;
  const def = opts.nextDef ?? cur.def;

  const nextData =
    opts.recipe
      ? produce(cur.data ?? {}, (draft: any) => {
          opts.recipe!(draft);
        })
      : (cur.data ?? {});

  const next = new CardEntity(cur.id, def, nextData);

  const nextCards = cards.slice();
  nextCards[i] = next as any;

  s.cards[1](nextCards);
  return next;
}

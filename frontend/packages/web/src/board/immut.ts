import { produce } from "immer";
import type { Engine } from "@donegeon/core";
import { CardEntity } from "@donegeon/core";

/**
 * Find a card index within a stack by cardId.
 * Returns -1 if not found.
 */
export function findCardIndex(engine: Engine, stackId: string, cardId: string): number {
  const s = engine.getStack(stackId);
  if (!s) return -1;
  const cards = s.cards[0]();
  return cards.findIndex((c: any) => c?.id === cardId);
}

/**
 * Replace a card in a stack immutably.
 * Returns the inserted card, or null if stack/card not found.
 */
export function replaceCard(
  engine: Engine,
  stackId: string,
  cardId: string,
  next: CardEntity
): CardEntity | null {
  const s = engine.getStack(stackId);
  if (!s) return null;

  let inserted: CardEntity | null = null;

  s.cards[1](
    produce(s.cards[0](), (draft) => {
      const i = draft.findIndex((c: any) => c?.id === cardId);
      if (i < 0) return;
      draft[i] = next as any;
      inserted = next;
    })
  );

  return inserted;
}

/**
 * Update only card.data immutably.
 * Keeps the same card.id and card.def, replaces card.data with an Immer-produced copy.
 * Returns the updated CardEntity, or null if not found.
 */
export function updateCardData(
  engine: Engine,
  stackId: string,
  cardId: string,
  recipe: (draftData: any) => void
): CardEntity | null {
  const s = engine.getStack(stackId);
  if (!s) return null;

  let updated: CardEntity | null = null;

  s.cards[1](
    produce(s.cards[0](), (cardsDraft) => {
      const i = cardsDraft.findIndex((c: any) => c?.id === cardId);
      if (i < 0) return;

      const cur = cardsDraft[i] as any;

      const nextData = produce(cur.data ?? {}, (dataDraft) => {
        recipe(dataDraft);
      });

      updated = new CardEntity(cur.id, cur.def, nextData);
      cardsDraft[i] = updated as any;
    })
  );

  return updated;
}

/**
 * "Promote" / change a card's def immutably by replacing the CardEntity instance.
 * Keeps id + data.
 * Returns the updated CardEntity, or null if not found.
 */
export function updateCardDef(
  engine: Engine,
  stackId: string,
  cardId: string,
  nextDef: any
): CardEntity | null {
  const s = engine.getStack(stackId);
  if (!s) return null;

  let updated: CardEntity | null = null;

  s.cards[1](
    produce(s.cards[0](), (cardsDraft) => {
      const i = cardsDraft.findIndex((c: any) => c?.id === cardId);
      if (i < 0) return;

      const cur = cardsDraft[i] as any;
      updated = new CardEntity(cur.id, nextDef, cur.data ?? {});
      cardsDraft[i] = updated as any;
    })
  );

  return updated;
}

/**
 * Full update: change def and/or data in one pass immutably.
 * - If nextDef is undefined, keep current def.
 * - recipe can mutate draftData.
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

  let updated: CardEntity | null = null;

  s.cards[1](
    produce(s.cards[0](), (cardsDraft) => {
      const i = cardsDraft.findIndex((c: any) => c?.id === cardId);
      if (i < 0) return;

      const cur = cardsDraft[i] as any;
      const def = opts.nextDef ?? cur.def;

      const nextData =
        opts.recipe
          ? produce(cur.data ?? {}, (dataDraft) => opts.recipe!(dataDraft))
          : (cur.data ?? {});

      updated = new CardEntity(cur.id, def, nextData);
      cardsDraft[i] = updated as any;
    })
  );

  return updated;
}

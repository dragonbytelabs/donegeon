import type { BoardState, BoardEntity, CardEntity, Vec2 } from "./types.js";

export function isOccupied(state: BoardState, pos: Vec2, ignoreEntityId?: string): boolean {
  for (const [id, e] of Object.entries(state.entities)) {
    if (ignoreEntityId && id === ignoreEntityId) continue;
    if (e.pos.x === pos.x && e.pos.y === pos.y) return true;
  }
  return false;
}

// v0.2 bounds: keep board within a large square to avoid runaway coordinates.
export function inBounds(pos: Vec2): boolean {
  const limit = 5000;
  return Math.abs(pos.x) <= limit && Math.abs(pos.y) <= limit;
}

export function isCard(e: BoardEntity): e is CardEntity {
  return e.kind === "card";
}

export function canStackCards(a: CardEntity, b: CardEntity): boolean {
  // Same type always stackable
  if (a.card_type !== b.card_type) return false;
  // Subtype constraint for food/resource stacks
  if (a.card_type === "food" || a.card_type === "resource") {
    return (a.subtype ?? "") !== "" && a.subtype === b.subtype;
  }
  return true;
}

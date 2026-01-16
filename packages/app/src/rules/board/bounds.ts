import type { BoardEntity } from "./types.js";

export type Rect = { w: number; h: number };

// v0.7 bounds model (in world units). This is the canonical source for collision/hover/minimap sizing.
export function entityBounds(e: BoardEntity): Rect {
  // Keep aligned with frontend card/deck visuals for now.
  if (e.kind === "deck") return { w: 120, h: 160 };
  return { w: 120, h: 160 };
}


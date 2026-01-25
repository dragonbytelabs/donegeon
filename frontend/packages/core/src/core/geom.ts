import type { Point, Pan } from "../model/types";

export const GRID = 22;
export const DOT_PHASE = 1;

export function snapToGrid(x: number, y: number) {
  const sx = Math.round((x - DOT_PHASE) / GRID) * GRID + DOT_PHASE;
  const sy = Math.round((y - DOT_PHASE) / GRID) * GRID + DOT_PHASE;
  return { x: sx, y: sy };
}

/**
 * DOM-free conversion helper.
 * Pass in the board root's client rect explicitly (from the web adapter).
 */
export function clientToBoardFromRect(
  clientX: number,
  clientY: number,
  rootRect: { left: number; top: number },
  pan: Pan
): Point {
  const localX = clientX - rootRect.left;
  const localY = clientY - rootRect.top;
  return { x: localX - pan.x, y: localY - pan.y };
}



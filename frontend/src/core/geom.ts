import { getPan } from "..//board/pan";
import type { Point } from "../model/types";

export const GRID = 22;
export const DOT_PHASE = 1;

export function snapToGrid(x: number, y: number) {
  const sx = Math.round((x - DOT_PHASE) / GRID) * GRID + DOT_PHASE;
  const sy = Math.round((y - DOT_PHASE) / GRID) * GRID + DOT_PHASE;
  return { x: sx, y: sy };
}

export function boardRect(boardEl: HTMLElement) {
  return boardEl.getBoundingClientRect();
}

export function clientToBoard(clientX: number, clientY: number, boardRoot: HTMLElement): Point {
  const br = boardRoot.getBoundingClientRect();
  const localX = clientX - br.left;
  const localY = clientY - br.top;

  const pan = getPan();
  return { x: localX - pan.x, y: localY - pan.y };
}
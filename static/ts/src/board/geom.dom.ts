import type { Pan, Point } from "../../../../frontend/packages/core";
import { clientToBoardFromRect } from "../../../../frontend/packages/core";

export function boardRect(boardEl: HTMLElement) {
  return boardEl.getBoundingClientRect();
}

export function clientToBoard(
  clientX: number,
  clientY: number,
  boardRoot: HTMLElement,
  pan: Pan
): Point {
  const r = boardRoot.getBoundingClientRect();
  return clientToBoardFromRect(
    clientX,
    clientY,
    { left: r.left, top: r.top },
    pan
  );
}

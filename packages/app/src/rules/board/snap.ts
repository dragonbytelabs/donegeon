import type { Vec2 } from "./types.js";

export function snapToGrid(pos: Vec2, gridSize: number): Vec2 {
  const gx = Math.round(pos.x / gridSize) * gridSize;
  const gy = Math.round(pos.y / gridSize) * gridSize;
  return { x: gx, y: gy };
}


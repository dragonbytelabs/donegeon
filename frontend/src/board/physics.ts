import type { Point } from "../model/types";
import { snapToGrid } from "../core/geom";

const UNSTACK_RADIUS = 120;

export function unstackPositions(origin: Point, n: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = origin.x + Math.cos(a) * UNSTACK_RADIUS;
    const y = origin.y + Math.sin(a) * (UNSTACK_RADIUS * 0.65);
    pts.push(snapToGrid(x, y));
  }
  return pts;
}

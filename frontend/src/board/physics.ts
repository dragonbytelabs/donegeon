import type { Point } from "../model/types";
import type { Engine } from "../model/engine";
import { snapToGrid } from "../core/geom";

// TODO: create a constants file
const UNSTACK_RADIUS = 120;
const CARD_W = 92;
const CARD_H = 124;
const STACK_OFFSET_Y = 20;

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

function stackHeight(n: number) {
  return CARD_H + Math.max(0, n - 1) * STACK_OFFSET_Y;
}

function raf() {
  return new Promise<void>((r) => requestAnimationFrame(() => r()));
}

function boundsForStack(engine: Engine, id: string) {
  const s = engine.getStack(id);
  if (!s) return null;

  const p = s.pos[0]();
  const n = s.cards[0]().length;

  const w = CARD_W;
  const h = stackHeight(n);

  return {
    x1: p.x,
    y1: p.y,
    x2: p.x + w,
    y2: p.y + h,
    cx: p.x + w / 2,
    cy: p.y + h / 2,
    w,
    h,
  };
}

/**
 * Wiggle/relax: pushes the given stackIds away from any overlaps (against ALL stacks).
 * Only moves the stacks in `stackIds` — everything else is treated as fixed.
 */
export async function animateRelax(
  engine: Engine,
  stackIds: string[],
  frames = 16,
  strength = 0.45,
) {
  const ids = stackIds.filter((id) => engine.getStack(id));
  if (ids.length === 0) return;

  for (let f = 0; f < frames; f++) {
    let moved = false;

    for (const id of ids) {
      const a = boundsForStack(engine, id);
      if (!a) continue;

      let pushX = 0;
      let pushY = 0;

      for (const otherId of engine.stacks.keys()) {
        if (otherId === id) continue;

        const b = boundsForStack(engine, otherId);
        if (!b) continue;

        const overlapX = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
        const overlapY = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);

        if (overlapX > 0 && overlapY > 0) {
          // direction away from other
          let dx = a.cx - b.cx;
          let dy = a.cy - b.cy;
          if (dx === 0 && dy === 0) dx = 1;

          const len = Math.hypot(dx, dy);
          dx /= len;
          dy /= len;

          const overlap = Math.min(overlapX, overlapY);
          const mag = (overlap + 2) * strength;

          pushX += dx * mag;
          pushY += dy * mag;
        }
      }

      if (pushX !== 0 || pushY !== 0) {
        const s = engine.getStack(id);
        if (!s) continue;
        const p = s.pos[0]();
        s.pos[1]({ x: p.x + pushX, y: p.y + pushY });
        moved = true;
      }
    }

    if (!moved) break;
    await raf();
  }

  // snap back to dots at end
  for (const id of ids) {
    const s = engine.getStack(id);
    if (!s) continue;
    const p = s.pos[0]();
    s.pos[1](snapToGrid(p.x, p.y));
  }
}

import type { Stack } from "./types";
import { CARD_H, CARD_W, MERGE_THRESHOLD_AREA, STACK_OFFSET_Y  } from "./constants";
import { uid, intersectArea, rect, snapToGrid  } from "./geometry";
import { stacks } from "./state";
import { canMergeStacks } from "./rules";


/**
 * Pick the stack with the greatest overlap area with `dragStackId`.
 * Returns null if overlap is below threshold.
 */
export function bestMergeTarget(dragStackId: string): string | null {
  const dragNode = document.getElementById(dragStackId) as HTMLElement | null;
  if (!dragNode) return null;

  const dr = rect(dragNode);
  let bestId: string | null = null;
  let bestScore = 0;

  for (const id of stacks.keys()) {
    if (id === dragStackId) continue;
    const node = document.getElementById(id) as HTMLElement | null;
    if (!node) continue;

    const score = intersectArea(dr, rect(node));
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  return bestScore >= MERGE_THRESHOLD_AREA ? bestId : null;
}


function wiggle(el: HTMLElement) {
  el.animate(
    [
      { transform: "rotate(0deg)" },
      { transform: "rotate(-2deg)" },
      { transform: "rotate(2deg)" },
      { transform: "rotate(0deg)" },
    ],
    { duration: 160, iterations: 1, easing: "ease-in-out" }
  );
}

export function wiggleNode(stackId: string) {
  const node = document.getElementById(stackId);
  if (!node) return;
  node.animate(
    [
      { transform: "translateZ(0) rotate(0deg)" },
      { transform: "translateZ(0) rotate(-2deg)" },
      { transform: "translateZ(0) rotate(2deg)" },
      { transform: "translateZ(0) rotate(0deg)" },
    ],
    { duration: 220, easing: "ease-in-out" }
  );
}


function aabbOverlap(a: Stack, b: Stack) {
  const ax1 = a.x, ay1 = a.y, ax2 = a.x + CARD_W, ay2 = a.y + CARD_H;
  const bx1 = b.x, by1 = b.y, bx2 = b.x + CARD_W, by2 = b.y + CARD_H;

  const overlapX = Math.min(ax2, bx2) - Math.max(ax1, bx1);
  const overlapY = Math.min(ay2, by2) - Math.max(ay1, by1);
  return { overlapX, overlapY };
}

/**
 * Relax collisions over time.
 * - If overlapping stacks can merge (rule), merge them.
 * - Otherwise repel them apart.
 *
 * `focusIds`: ids to prioritize (like newly unstacked ones). They will repel against *all* stacks.
 */
export async function animateRelax(focusIds: string[], frames = 14) {
  const focus = new Set(focusIds);

  for (let f = 0; f < frames; f++) {
    let changed = false;

    const ids = Array.from(stacks.keys());

    // repel focus stacks against everyone (and also among themselves)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const aId = ids[i];
        const bId = ids[j];

        // optional: you can skip non-focus/non-focus interactions for perf
        if (!focus.has(aId) && !focus.has(bId)) continue;

        const a = stacks.get(aId);
        const b = stacks.get(bId);
        if (!a || !b) continue;

        const { overlapX, overlapY } = aabbOverlap(a, b);

        if (overlapX > 0 && overlapY > 0) {
          // If mergeable: merge b into a (or vice versa)
          if (canMergeStacks(a, b)) {
            a.cards.push(...b.cards);
            stacks.delete(bId);
            document.getElementById(bId)?.remove();
            changed = true;
            continue;
          }

          // Repel
          const acx = a.x + CARD_W / 2;
          const acy = a.y + CARD_H / 2;
          const bcx = b.x + CARD_W / 2;
          const bcy = b.y + CARD_H / 2;

          let dx = acx - bcx;
          let dy = acy - bcy;
          if (dx === 0 && dy === 0) dx = 1;

          const len = Math.sqrt(dx * dx + dy * dy);
          dx /= len;
          dy /= len;

          const push = Math.max(overlapX, overlapY) * 0.22 + 1;

          a.x += dx * push;
          a.y += dy * push;
          b.x -= dx * push;
          b.y -= dy * push;

          // wiggle both (lightweight, only on first few frames)
          if (f < 3) {
            const an = document.getElementById(aId);
            const bn = document.getElementById(bId);
            if (an) wiggle(an);
            if (bn) wiggle(bn);
          }

          changed = true;
        }
      }
    }

    // paint positions this frame (no snapping yet for smoother movement)
    for (const id of focusIds) {
      const s = stacks.get(id);
      const node = document.getElementById(id);
      if (s && node) {
        node.style.left = `${s.x}px`;
        node.style.top = `${s.y}px`;
      }
    }

    // let the browser render
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    if (!changed) break;
  }

  // snap focus stacks to dots at the end
  for (const id of focusIds) {
    const s = stacks.get(id);
    if (!s) continue;
    const sn = snapToGrid(s.x, s.y);
    s.x = sn.x;
    s.y = sn.y;
  }
}

/**
 * Split from a given card index into a new stack.
 * idx is the card being pulled + everything above it.
 */
export function splitFromIndex(stackId: string, idx: number): string | null {
  const s = stacks.get(stackId);
  if (!s) return null;
  if (idx <= 0) return null; // don't split bottom card by default
  if (idx >= s.cards.length) return null;
  if (s.cards.length <= 1) return null;

  const pulled = s.cards.splice(idx);
  const newId = uid("stack");

  const ns: Stack = {
    id: newId,
    x: s.x + 12,
    y: s.y + idx * STACK_OFFSET_Y,
    cards: pulled,
  };

  const sn = snapToGrid(ns.x, ns.y);
  ns.x = sn.x;
  ns.y = sn.y;

  stacks.set(newId, ns);

  // If original stack becomes empty (shouldn't), clean it
  if (s.cards.length === 0) {
    stacks.delete(stackId);
    document.getElementById(stackId)?.remove();
  }

  return newId;
}
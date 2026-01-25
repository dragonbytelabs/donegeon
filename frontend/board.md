# LLM Context Pack — @cleartify/core (Source of Truth)

This `llm.md` is a single-file mirror of `packages/core/src`.
Edit sections carefully and keep paths + triple-backtick fences intact so the source tree can be reconstructed.

<!-- LLM_HEADER_END -->

# board/contextmenu.ts

```ts
type MenuItem = { label: string; onClick: () => void; disabled?: boolean };

let menuEl: HTMLDivElement | null = null;

function ensureMenu(root: HTMLElement) {
  if (menuEl) return menuEl;

  menuEl = document.createElement("div");
  menuEl.id = "ctxMenu";
  menuEl.className =
    "fixed z-[9999] hidden min-w-[160px] overflow-hidden rounded-xl border border-border bg-card/90 text-foreground shadow-lg backdrop-blur";
  menuEl.innerHTML = `<div class="p-1" data-body></div>`;
  document.body.appendChild(menuEl);

  // click outside closes
  window.addEventListener("pointerdown", (e) => {
    if (!menuEl || menuEl.classList.contains("hidden")) return;
    const t = e.target as HTMLElement;
    if (t.closest("#ctxMenu")) return;
    hideContextMenu();
  });

  // escape closes
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideContextMenu();
  });

  return menuEl;
}

export function showContextMenu(opts: {
  root: HTMLElement;
  clientX: number;
  clientY: number;
  items: MenuItem[];
}) {
  const el = ensureMenu(opts.root);
  const body = el.querySelector("[data-body]") as HTMLDivElement;

  body.innerHTML = "";
  for (const item of opts.items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent";
    btn.textContent = item.label;
    btn.disabled = !!item.disabled;
    btn.addEventListener("click", () => {
      hideContextMenu();
      item.onClick();
    });
    body.appendChild(btn);
  }

  // position: keep on-screen
  el.classList.remove("hidden");
  const pad = 8;
  const { innerWidth: W, innerHeight: H } = window;
  const rect = el.getBoundingClientRect();
  let x = opts.clientX;
  let y = opts.clientY;

  if (x + rect.width + pad > W) x = W - rect.width - pad;
  if (y + rect.height + pad > H) y = H - rect.height - pad;
  if (x < pad) x = pad;
  if (y < pad) y = pad;

  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

export function hideContextMenu() {
  if (!menuEl) return;
  menuEl.classList.add("hidden");
}
```

# board/geom.dom.ts

```ts
import type { Pan, Point } from "@deez/core";
import { clientToBoardFromRect } from "@deez/core";

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
  return clientToBoardFromRect(clientX, clientY, { left: r.left, top: r.top }, pan);
}
```

# board/index.ts

```ts
import { Engine } from "../model/engine";
import { mountBoard } from "./render";
import { bindMobilePan, bindBoardInput, bindLongPressMenu } from "./input";
import { spawn } from "../model/catalog";
import { initShell } from "./sidebar";
import { applyPan } from "./pan";


document.addEventListener("DOMContentLoaded", () => {
  const boardRoot = document.getElementById("boardRoot")!;
  const boardEl = document.getElementById("board")!;

  applyPan(boardEl);

  const engine = new Engine();

  mountBoard(engine, boardEl);
  initShell(engine, boardRoot);
  bindMobilePan(boardRoot, boardEl);
  bindBoardInput(engine, boardRoot, boardEl);
  bindLongPressMenu(engine, document.getElementById("boardRoot")!);

  // Seed demo stacks
  engine.createStack({ x: 380, y: 220 }, [spawn("event.create_user_submission")]);
  engine.createStack({ x: 560, y: 210 }, [spawn("agent.ai_tools")]);
  engine.createStack({ x: 770, y: 180 }, [spawn("integration.slack"), spawn("integration.entra"), spawn("integration.jira")]);

  // Expose for debugging in devtools if you want
  (window as any).__engine = engine;
});
```

# board/input.ts

```ts
import type { Engine } from "@cleartify/core";
import { snapToGrid } from "@cleartify/core";
import { clientToBoard } from "./geom.dom";
import { showContextMenu, hideContextMenu } from "./contextmenu";
import { getPan, setPan, applyPan } from "./pan";
import { unstackPositions, animateRelax } from "./physics";

const MERGE_THRESHOLD_AREA = 92 * 40; // keep for now

type DragState = { stackId: string; pointerId: number; offX: number; offY: number };
type PressState = {
  pointerId: number;
  startX: number;
  startY: number;
  stackId: string;
  cardIndex?: number;
  timer: number;
};

type PanDrag =
  | { pointerId: number; startX: number; startY: number; startPanX: number; startPanY: number }
  | null;

let drag: DragState | null = null;
let press: PressState | null = null;
let activeStackId: string | null = null;
let touchCandidate:
  | { pointerId: number; stackId: string; offX: number; offY: number; startX: number; startY: number }
  | null = null;

let panDrag: PanDrag = null;

// -------------------------
// helpers
// -------------------------

function isOnCardOrStack(t: HTMLElement) {
  return !!t.closest(".sl-card") || !!t.closest(".sl-stack");
}

function stackNodeById(id: string): HTMLElement | null {
  return (
    (document.querySelector(`.sl-stack[data-stack-id="${id}"]`) as HTMLElement | null) ||
    (document.getElementById(id) as HTMLElement | null)
  );
}

function getStackAndIndexFromEventTarget(t: HTMLElement): { stackId: string; cardIndex?: number } | null {
  const stackEl = t.closest(".sl-stack") as HTMLElement | null;
  if (!stackEl) return null;

  const stackId = stackEl.dataset.stackId || stackEl.id;
  if (!stackId) return null;

  const cardEl = t.closest(".sl-card") as HTMLElement | null;
  const idxRaw = cardEl?.dataset.cardIndex;
  const cardIndex = idxRaw != null ? Number(idxRaw) : undefined;

  return { stackId, cardIndex: Number.isFinite(cardIndex) ? cardIndex : undefined };
}

function clearPress() {
  if (!press) return;
  window.clearTimeout(press.timer);
  press = null;
}

function cancelDrag() {
  drag = null;
}

function rect(el: HTMLElement) {
  return el.getBoundingClientRect();
}

function intersectArea(a: DOMRect, b: DOMRect) {
  const x1 = Math.max(a.left, b.left);
  const y1 = Math.max(a.top, b.top);
  const x2 = Math.min(a.right, b.right);
  const y2 = Math.min(a.bottom, b.bottom);
  const w = x2 - x1;
  const h = y2 - y1;
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Finds best overlap target for merging.
 */
function bestMergeTarget(engine: Engine, draggedId: string): string | null {
  const draggedNode = stackNodeById(draggedId);
  if (!draggedNode) return null;

  const dr = rect(draggedNode);
  let best: string | null = null;
  let bestScore = 0;

  for (const id of engine.stacks.keys()) {
    if (id === draggedId) continue;

    const node = stackNodeById(id);
    if (!node) continue;

    const score = intersectArea(dr, rect(node));
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }

  return bestScore >= MERGE_THRESHOLD_AREA ? best : null;
}

function startDrag(engine: Engine, stackId: string, e: PointerEvent, boardRoot: HTMLElement) {
  const s = engine.stacks.get(stackId);
  if (!s) return;

  clearPress();
  hideContextMenu();

  engine.bringToFront(stackId);

  const node = stackNodeById(stackId);
  node?.setPointerCapture(e.pointerId);

  const pan = getPan();
  const p = clientToBoard(e.clientX, e.clientY, boardRoot, pan);
  const sp = s.pos[0]();

  drag = { stackId, pointerId: e.pointerId, offX: p.x - sp.x, offY: p.y - sp.y };
}

// -------------------------
// panning
// -------------------------

/**
 * Pan rules:
 * - Desktop: RIGHT mouse drag on empty space.
 * - Touch/Tablet: 1-finger drag on empty space pans.
 */
export function bindMobilePan(boardRoot: HTMLElement, boardEl: HTMLElement) {
  // we manage gestures; prevents browser scroll/zoom hijacking on the board
  boardRoot.style.touchAction = "none";

  boardRoot.addEventListener("contextmenu", (e) => e.preventDefault());

  const canStartPan = (t: HTMLElement) => !t.closest(".sl-card") && !t.closest(".sl-stack");

  let active:
    | { pointerId: number; startX: number; startY: number; startPanX: number; startPanY: number }
    | null = null;

  function onMove(e: PointerEvent) {
    if (!active) return;
    if (e.pointerId !== active.pointerId) return;

    // important on mobile: stop the browser from treating this as a scroll
    e.preventDefault();

    const dx = e.clientX - active.startX;
    const dy = e.clientY - active.startY;

    setPan(active.startPanX + dx, active.startPanY + dy);
    applyPan(boardEl);
  }

  function onUp(e: PointerEvent) {
    if (!active) return;
    if (e.pointerId !== active.pointerId) return;

    active = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  }

  boardRoot.addEventListener("pointerdown", (e) => {
    const t = e.target as HTMLElement;
    if (!canStartPan(t)) return;

    // Desktop: right mouse only
    if (e.pointerType === "mouse" && e.button !== 2) return;

    // Touch/pen: primary only
    if (e.pointerType !== "mouse" && e.button === 2) return;

    e.preventDefault();
    clearPress();
    cancelDrag();
    hideContextMenu();

    const cur = getPan();
    active = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: cur.x,
      startPanY: cur.y,
    };

    // Use window listeners (works across mobile browsers)
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  });
}


// -------------------------
// long-press menu (touch/pen)
// -------------------------

export function bindLongPressMenu(engine: Engine, boardRoot: HTMLElement) {
  boardRoot.addEventListener("contextmenu", (e) => e.preventDefault());

  boardRoot.addEventListener("pointerdown", (e) => {
    const pe = e as PointerEvent;

    // touch/pen only
    if (pe.pointerType === "mouse") return;

    const hit = getStackAndIndexFromEventTarget(pe.target as HTMLElement);
    if (!hit) return;
    pe.preventDefault();

    clearPress();

    press = {
      pointerId: pe.pointerId,
      startX: pe.clientX,
      startY: pe.clientY,
      stackId: hit.stackId,
      cardIndex: hit.cardIndex,
      timer: window.setTimeout(() => {
        const st = engine.getStack(hit.stackId);
        const n = st ? st.cards[0]().length : 0;

        showContextMenu({
          root: boardRoot,
          clientX: pe.clientX,
          clientY: pe.clientY,
          items: [
            {
              label: "Pop top",
              disabled: n <= 1,
              onClick: async () => {
                const s = engine.getStack(hit.stackId);
                if (!s) return;
                const top = s.cards[0]().length - 1;

                const ns = engine.splitStack(hit.stackId, top, { x: 12, y: 0 });
                if (!ns) return;

                engine.bringToFront(ns.id);
                await animateRelax(engine, [ns.id], 14);
              },
            },
            {
              label: "Unstack",
              disabled: n <= 1,
              onClick: async () => {
                const s = engine.getStack(hit.stackId);
                if (!s) return;

                const origin = s.pos[0]();
                const count = s.cards[0]().length;

                const created = engine.unstack(hit.stackId, unstackPositions(origin, count));
                if (created.length) {
                  await animateRelax(engine, created.map((x) => x.id), 22);
                }
              },
            },
            {
              label: hit.cardIndex != null ? `Split here (${hit.cardIndex + 1})` : "Split here",
              disabled: hit.cardIndex == null || n <= 1 || hit.cardIndex >= n - 1,
              onClick: async () => {
                const ns = engine.splitStack(hit.stackId, hit.cardIndex!);
                if (ns) {
                  engine.bringToFront(ns.id);
                  await animateRelax(engine, [ns.id], 12);
                }
              },
            },
          ],
        });

        clearPress();
      }, 450),
    };
  });

  boardRoot.addEventListener("pointermove", (e) => {
    const pe = e as PointerEvent;
    if (!press) return;
    if (pe.pointerId !== press.pointerId) return;

    const dx = pe.clientX - press.startX;
    const dy = pe.clientY - press.startY;
    if (dx * dx + dy * dy > 36) {
      // > 6px cancels
      clearPress();
    }
  });

  boardRoot.addEventListener("pointerup", () => clearPress());
  boardRoot.addEventListener("pointercancel", () => clearPress());

  // Any new interaction closes menu
  boardRoot.addEventListener("pointerdown", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest("#ctxMenu")) return; // allow menu interaction
    hideContextMenu();
  });
}

// -------------------------
// stack drag + split + merge + hotkeys
// -------------------------

export function bindBoardInput(engine: Engine, boardRoot: HTMLElement, boardEl: HTMLElement) {
  boardRoot.addEventListener("contextmenu", (e) => e.preventDefault());

  boardEl.addEventListener("pointerdown", (e) => {
    const pe = e as PointerEvent;
    const t = pe.target as HTMLElement;

    // if panning is active (we started on empty space), don't start stack drag
    if (panDrag) return;

    const stackNode = t.closest(".sl-stack") as HTMLElement | null;
    if (!stackNode) return;

    // ignore right-click on stacks (right-click is for panning empty space)
    if (pe.pointerType === "mouse" && pe.button === 2) return;

    const stackId = stackNode.dataset.stackId!;
    const s = engine.stacks.get(stackId);
    if (!s) return;

    activeStackId = stackId;

    // detect card index
    const cardNode = t.closest(".sl-card") as HTMLElement | null;
    const idx = cardNode ? Number(cardNode.dataset.cardIndex ?? "-1") : -1;

    const cards = s.cards[0]();
    const topIdx = cards.length - 1;

    const isMouse = pe.pointerType === "mouse";

    // ignore right-click on stacks 
    if (isMouse && pe.button === 2) return;
    // SHIFT behavior:
    // - shift+drag TOP card => POP top into new stack (any stack size)
    // - shift+drag middle/bottom => split at idx (new gets [idx..end])
    if (isMouse && pe.shiftKey && idx >= 0 && cards.length > 1) {
      // Special case: stack of 2, shift-drag the BACK/BOTTOM card
      if (cards.length === 2 && idx === 0) {
        const ns = engine.popBottom(stackId, { x: 0, y: 0 });
        if (ns) startDrag(engine, ns.id, pe, boardRoot);
        return;
      }

      if (idx === topIdx) {
        const ns = engine.splitStack(stackId, topIdx, { x: 10, y: 0 });
        if (ns) startDrag(engine, ns.id, pe, boardRoot);
        return;
      }
      if (idx < topIdx) {
        const ns = engine.splitStack(stackId, idx);
        if (ns) startDrag(engine, ns.id, pe, boardRoot);
        return;
      }
    }

    // Normal drag: only top card
    if (idx !== topIdx) return;
    if (!isMouse) {
      // Touch/pen: don't start drag immediately; wait for movement threshold
      if (idx !== topIdx) return; // only allow dragging top card on touch (splits via long-press menu)
      const pan = getPan();
      const p = clientToBoard(pe.clientX, pe.clientY, boardRoot, pan);
      const sp = s.pos[0]();
      touchCandidate = {
        pointerId: pe.pointerId,
        stackId,
        offX: p.x - sp.x,
        offY: p.y - sp.y,
        startX: pe.clientX,
        startY: pe.clientY,
      };
      return;
    }

    startDrag(engine, stackId, pe, boardRoot);
  });

  window.addEventListener("pointermove", (e) => {
    if (touchCandidate && e.pointerId === touchCandidate.pointerId && !drag) {
      const dx = e.clientX - touchCandidate.startX;
      const dy = e.clientY - touchCandidate.startY;
      if (dx * dx + dy * dy > 64) { // 8px threshold
        const s2 = engine.stacks.get(touchCandidate.stackId);
        if (s2) {
          engine.bringToFront(touchCandidate.stackId);
          const node = stackNodeById(touchCandidate.stackId);
          node?.setPointerCapture(e.pointerId);
          drag = {
            stackId: touchCandidate.stackId,
            pointerId: e.pointerId,
            offX: touchCandidate.offX,
            offY: touchCandidate.offY,
          };
        }
        touchCandidate = null;
      }
    }

    if (!drag) return;
    if (panDrag) return;

    const s = engine.stacks.get(drag.stackId);
    if (!s) return;

    const pan = getPan();
    const p = clientToBoard(e.clientX, e.clientY, boardRoot, pan);
    s.pos[1]({ x: p.x - drag.offX, y: p.y - drag.offY });
  });

  window.addEventListener("pointerup", async () => {
    if (!drag) return;

    const id = drag.stackId;
    const s = engine.stacks.get(id);
    drag = null;

    if (!s) return;

    // snap first
    const p = s.pos[0]();
    s.pos[1](snapToGrid(p.x, p.y));

    // merge?
    const target = bestMergeTarget(engine, id);
    if (target) {
      engine.mergeStacks(target, id);
      return;
    }

    // no merge => wiggle away from overlaps
    await animateRelax(engine, [id], 18);
  });

  // Hotkey: U unstack active stack
  window.addEventListener("keydown", async (e) => {
    if (e.key.toLowerCase() !== "u") return;
    if (!activeStackId) return;

    const s = engine.getStack(activeStackId);
    if (!s) return;

    const n = s.cards[0]().length;
    if (n <= 1) return;

    const origin = s.pos[0]();
    const created = engine.unstack(activeStackId, unstackPositions(origin, n));
    activeStackId = null;

    if (created.length) {
      await animateRelax(engine, created.map((x) => x.id), 22);
    }
  });
}
```

# board/pan.ts

```ts
import type { Pan } from "../model/types";

let pan: Pan = { x: 0, y: 0 };

export function getPan(): Pan {
  return pan;
}

export function setPan(x: number, y: number) {
  pan = { x, y };
}

export function applyPan(boardEl: HTMLElement, p: Pan = pan) {
  boardEl.style.transform = `translate(${p.x}px, ${p.y}px)`;
}
```

# board/physics.ts

```ts
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
```

# board/render.ts

```ts
import { createEffect } from "../core/reactivity";
import type { Engine } from "../model/engine";
import type { StackEntity } from "../model/stack";
import { type Mounted } from "../model/types";

const CARD_W = 92;
const CARD_H = 124;
const STACK_OFFSET_Y = 20;

function stackHeight(n: number) {
  return CARD_H + Math.max(0, n - 1) * STACK_OFFSET_Y;
}

export function mountBoard(engine: Engine, boardEl: HTMLElement) {
  const mounted = new Map<string, Mounted>();

  // Mount/unmount based on engine.stackIds signal
  createEffect(() => {
    const ids = engine.stackIds[0]();

    // remove missing
    for (const [id, m] of Array.from(mounted.entries())) {
      if (!ids.includes(id)) {
        m.dispose();
        m.node.remove();
        mounted.delete(id);
      }
    }

    // add new
    for (const id of ids) {
      if (mounted.has(id)) continue;
      const s = engine.stacks.get(id);
      if (!s) continue;

      const m = mountStack(engine, s);
      mounted.set(id, m);
      boardEl.appendChild(m.node);
    }
  });

  return mounted;
}

function mountStack(engine: Engine, s: StackEntity): Mounted {
  const node = document.createElement("div");
  node.className = "sl-stack";
  node.dataset.stackId = s.id;
  node.style.position = "absolute";
  node.style.overflow = "visible";
  node.style.touchAction = "none";

  const disposers: Array<() => void> = [];

  // position
  disposers.push(
    createEffect(() => {
      const p = s.pos[0]();
      node.style.left = `${p.x}px`;
      node.style.top = `${p.y}px`;
    })
  );

  // z
  disposers.push(
    createEffect(() => {
      node.style.zIndex = String(s.z[0]());
    })
  );

  // cards (rebuild when array changes)
  disposers.push(
    createEffect(() => {
      const cards = s.cards[0]();
      node.style.width = `${CARD_W}px`;
      node.style.height = `${stackHeight(cards.length)}px`;
      node.innerHTML = "";

      cards.forEach((c, idx) => {
        const isTop = idx === cards.length - 1;
        const el = document.createElement("div");
        el.className = `sl-card ${c.def.skinClass}` + (isTop ? " sl-top" : "");
        el.dataset.cardIndex = String(idx);
        el.style.position = "absolute";
        el.style.left = "0px";
        el.style.top = `${idx * STACK_OFFSET_Y}px`;

        // allow clicking middle cards for shift-split
        // (if you want non-top cards to be "harder" to grab later, we can tweak UX)
        el.innerHTML = `
          <div class="sl-card__title">${c.def.title}</div>
          <div class="sl-card__body">
            <div class="sl-card__icon"><span style="font-size:18px;opacity:.85">${c.def.icon}</span></div>
          </div>
          ${c.def.leftBadge ? `<div class="sl-badge sl-badge--left">${c.def.leftBadge}</div>` : ""}
          ${c.def.rightBadge ? `<div class="sl-badge sl-badge--right">${c.def.rightBadge}</div>` : ""}
        `;
        node.appendChild(el);
      });
    })
  );

  return {
    node,
    dispose: () => {
      for (const d of disposers) d();
      disposers.length = 0;
    },
  };
}
```

# board/sidebar.ts

```ts
// frontend/src/board/sidebar.ts
import type { Engine } from "@cleartify/core";
import { spawn, snapToGrid } from "@cleartify/core";
import { clientToBoard } from "./geom.dom";
import { getPan } from "./pan";

type SpawnDrag = {
  pointerId: number;
  defId: string;
  startX: number;
  startY: number;
  moved: boolean;
  ghost: HTMLDivElement;
};

let drag: SpawnDrag | null = null;

function qs<T extends Element>(sel: string) {
  return document.querySelector(sel) as T | null;
}

function isSidebarOpen(sidebar: HTMLElement) {
  // on mobile we slide it in/out via translate-x classes
  return !sidebar.classList.contains("-translate-x-full");
}

function closeSidebar(sidebar: HTMLElement, backdrop: HTMLElement | null) {
  sidebar.classList.add("-translate-x-full");
  backdrop?.classList.add("hidden");
}

function toggleSidebar(sidebar: HTMLElement, backdrop: HTMLElement | null) {
  const open = isSidebarOpen(sidebar);
  if (open) closeSidebar(sidebar, backdrop);
  else {
    sidebar.classList.remove("-translate-x-full");
    backdrop?.classList.remove("hidden");
  }
}

function makeGhost(defId: string) {
  const c = spawn(defId);

  const el = document.createElement("div");
  el.className = `sl-card ${c.def.skinClass}`;
  el.style.position = "fixed";
  el.style.left = "0px";
  el.style.top = "0px";
  el.style.width = "92px";
  el.style.height = "124px";
  el.style.pointerEvents = "none";
  el.style.opacity = "0.92";
  el.style.transform = "translate(-9999px, -9999px) scale(1.03)";
  el.style.zIndex = "99999";
  el.style.boxShadow = "0 10px 30px rgba(0,0,0,.35)";

  el.innerHTML = `
    <div class="sl-card__title">${c.def.title}</div>
    <div class="sl-card__body">
      <div class="sl-card__icon"><span style="font-size:18px;opacity:.85">${c.def.icon}</span></div>
    </div>
    ${c.def.leftBadge ? `<div class="sl-badge sl-badge--left">${c.def.leftBadge}</div>` : ""}
    ${c.def.rightBadge ? `<div class="sl-badge sl-badge--right">${c.def.rightBadge}</div>` : ""}
  `;

  document.body.appendChild(el);
  return el;
}

function moveGhost(el: HTMLElement, clientX: number, clientY: number) {
  // center-ish under pointer
  const x = clientX - 46;
  const y = clientY - 28;
  el.style.transform = `translate(${x}px, ${y}px) scale(1.03)`;
}

export function initShell(engine: Engine, boardRoot: HTMLElement) {
  const sidebarToggle = qs<HTMLButtonElement>("#sidebarToggle");
  const sidebar = qs<HTMLElement>("#sidebar");
  const backdrop = qs<HTMLElement>("#sidebarBackdrop");

  if (!sidebar) return;

  // ---- sidebar toggle/backdrop ----
  sidebarToggle?.addEventListener("click", () => toggleSidebar(sidebar, backdrop));
  backdrop?.addEventListener("click", () => closeSidebar(sidebar, backdrop));

  // ---- spawn by dragging from sidebar ----
  // Works on touch too (pointer events)
  sidebar.addEventListener("pointerdown", (e) => {
    const t = e.target as HTMLElement;
    const btn = t.closest("button[data-spawn]") as HTMLButtonElement | null;
    if (!btn) return;

    const defId = btn.dataset.spawn;
    if (!defId) return;

    // prevent text selection / scrolling
    e.preventDefault();
    e.stopPropagation();

    // On mobile, if the sidebar is open, we can keep it open while dragging,
    // but it often blocks the board. Close it as soon as the drag starts moving.
    const ghost = makeGhost(defId);
    moveGhost(ghost, e.clientX, e.clientY);

    drag = {
      pointerId: e.pointerId,
      defId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      ghost,
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    function onMove(ev: PointerEvent) {
      if (!drag) return;
      if (ev.pointerId !== drag.pointerId) return;

      // stop browser scroll on mobile
      ev.preventDefault();

      const dx = ev.clientX - drag.startX;
      const dy = ev.clientY - drag.startY;
      if (!drag.moved && dx * dx + dy * dy > 36) {
        drag.moved = true;

        // once we "commit" to dragging, hide sidebar on mobile so board is reachable
        if (window.matchMedia("(max-width: 768px)").matches) {
          closeSidebar(sidebar!, backdrop);
        }
      }

      moveGhost(drag.ghost, ev.clientX, ev.clientY);
    }

    function onUp(ev: PointerEvent) {
      if (!drag) return;
      if (ev.pointerId !== drag.pointerId) return;

      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);

      const ghostEl = drag.ghost;
      const def = drag.defId;
      const wasMoved = drag.moved;

      drag = null;
      ghostEl.remove();

      // If they didn’t move much, treat it as a normal click-spawn (drop near center)
      if (!wasMoved) {
        const br = boardRoot.getBoundingClientRect();
        const cx = br.left + br.width * 0.55;
        const cy = br.top + br.height * 0.35;

        const pan = getPan();
        const p = clientToBoard(cx, cy, boardRoot, pan);
        engine.createStack(snapToGrid(p.x, p.y), [spawn(def)]);
        return;
      }

      // Drag-drop spawn: only if released over the boardRoot rect
      const br = boardRoot.getBoundingClientRect();
      const inside =
        ev.clientX >= br.left &&
        ev.clientX <= br.right &&
        ev.clientY >= br.top &&
        ev.clientY <= br.bottom;

      if (!inside) return;

      const pan = getPan();
      const p = clientToBoard(ev.clientX, ev.clientY, boardRoot, pan);
      engine.createStack(snapToGrid(p.x, p.y), [spawn(def)]);
    }
  });
}
```

# board/types.ts

```ts
export type DragState = { stackId: string; pointerId: number; offX: number; offY: number };

export type PressState = {
  pointerId: number;
  startX: number;
  startY: number;
  timer: number;
  stackId: string;
  cardIndex?: number;
};

export type PanState = {
  active: boolean;
  pointers: Map<number, { x: number; y: number }>;
  lastMid?: { x: number; y: number };
};

export type Mounted = {
  node: HTMLElement;
  dispose: () => void;
};
```

# model/catalog.ts

```ts
import type { CardDef, CardEntity } from "@cleartify/core";
import { uid } from "@cleartify/core";

export const workflowDefs: Record<string, CardDef> = {
  // Event / Trigger
  "event.create_user_submission": {
    id: "event.create_user_submission",
    kind: "event",
    title: "Create User",
    icon: "📝",
    skinClass: "sl-kind-quest",
    leftBadge: "1",
  },

  // Agent
  "agent.ai_tools": {
    id: "agent.ai_tools",
    kind: "agent",
    title: "AI Agent",
    icon: "🤖",
    skinClass: "sl-kind-blank",
    leftBadge: "AGENT",
  },

  // Rule
  "rule.is_manager": {
    id: "rule.is_manager",
    kind: "rule",
    title: "Is Manager?",
    icon: "⎇",
    skinClass: "sl-kind-stone",
    leftBadge: "RULE",
    rightBadge: "T/F",
  },

  // Integrations
  "integration.slack": {
    id: "integration.slack",
    kind: "integration",
    title: "Slack",
    icon: "💬",
    skinClass: "sl-kind-coin",
    leftBadge: "TOOL",
  },
  "integration.entra": {
    id: "integration.entra",
    kind: "integration",
    title: "Entra ID",
    icon: "🧩",
    skinClass: "sl-kind-wood",
    leftBadge: "TOOL",
  },
  "integration.jira": {
    id: "integration.jira",
    kind: "integration",
    title: "Jira",
    icon: "🎫",
    skinClass: "sl-kind-food",
    leftBadge: "TOOL",
  },

  // Actions
  "action.invite_slack_channel": {
    id: "action.invite_slack_channel",
    kind: "action",
    title: "Invite",
    icon: "➕",
    skinClass: "sl-kind-quest",
    leftBadge: "ACT",
  },
  "action.update_slack_profile": {
    id: "action.update_slack_profile",
    kind: "action",
    title: "Update Profile",
    icon: "✏️",
    skinClass: "sl-kind-quest",
    leftBadge: "ACT",
  },

  // Memory
  "memory.state_db": {
    id: "memory.state_db",
    kind: "memory",
    title: "State DB",
    icon: "🗄️",
    skinClass: "sl-kind-stone",
    leftBadge: "MEM",
  },
};

export function spawn(defId: keyof typeof workflowDefs, data: Record<string, unknown> = {}) {
  const defs = workflowDefs[defId];
  if(!defs) {
    throw new Error(`Unknown card defs ID: ${defId}`);
  }

  return new CardEntity(uid("card"), defs, data);
}
```

# model/deck.ts

```ts
import { uid, CardEntity, type CardDef, type CardDefId, type CardData } from "@cleartify/core";

export class Deck {
  private defs = new Map<CardDefId, CardDef>();

  constructor(initial: CardDef[] = []) {
    for (const d of initial) this.defs.set(d.id, d);
  }

  addDef(def: CardDef) {
    this.defs.set(def.id, def);
  }

  getDef(id: CardDefId) {
    const d = this.defs.get(id);
    if (!d) throw new Error(`Unknown CardDef: ${id}`);
    return d;
  }

  allDefs(): CardDef[] {
    return Array.from(this.defs.values());
  }

  spawn(defId: CardDefId, data: CardData = {}) {
    const def = this.getDef(defId);
    return new CardEntity(uid("card"), def, data);
  }
}
```


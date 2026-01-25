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

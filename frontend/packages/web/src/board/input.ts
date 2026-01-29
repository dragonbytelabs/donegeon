import type { Engine } from "@donegeon/core";
import { snapToGrid } from "@donegeon/core";
import { DonegeonConfig } from "../model/types";
import { clientToBoard } from "./geom.dom";
import { getPan, setPan, applyPan } from "./pan";
import { openPackFromDeck } from "./deck";
import { spawn } from "../model/catalog";

const MERGE_THRESHOLD_AREA = 92 * 40; // same spirit as legacy
const DRAG_CLICK_SLOP_PX = 6; // movement threshold to still count as click

type DragState =
  | {
    stackId: string;
    pointerId: number;
    offX: number;
    offY: number
    startClientX: number;
    startClientY: number;
    moved: boolean;
  }
  | null;

function ensureTaskFaceCard(engine: Engine, stackId: string) {
  const s = engine.getStack(stackId);
  if (!s) return;

  const cards = s.cards[0]();
  if (cards.length <= 1) return;

  const tasks = cards.filter(c => c.def.kind === "task");
  if (!tasks.length) return;

  const others = cards.filter(c => c.def.kind !== "task");
  const next = [...others, ...tasks];

  // only set if changed
  let changed = false;
  for (let i = 0; i < cards.length; i++) {
    if (cards[i] !== next[i]) { changed = true; break; }
  }
  if (changed) s.cards[1](next);
}


function stackNodeById(id: string): HTMLElement | null {
  return document.querySelector(`.sl-stack[data-stack-id="${id}"]`) as HTMLElement | null;
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

/**
 * Pan rules:
 * - Desktop: RIGHT mouse drag on empty space.
 * - Touch/Tablet: 1-finger drag on empty space pans.
 */
function bindMobilePan(boardRoot: HTMLElement, boardEl: HTMLElement) {
  boardRoot.style.touchAction = "none";
  boardRoot.addEventListener("contextmenu", (e) => e.preventDefault());

  const canStartPan = (t: HTMLElement) => !t.closest(".sl-card") && !t.closest(".sl-stack");

  let active:
    | { pointerId: number; startX: number; startY: number; startPanX: number; startPanY: number }
    | null = null;

  function onMove(e: PointerEvent) {
    if (!active) return;
    if (e.pointerId !== active.pointerId) return;

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
    const pe = e as PointerEvent;
    const t = pe.target as HTMLElement;

    if (!canStartPan(t)) return;

    // Desktop: right mouse only
    if (e.pointerType === "mouse" && e.button !== 2) return;

    // Touch/pen: primary only (ignore right-click semantics)
    if (e.pointerType !== "mouse" && e.button === 2) return;

    e.preventDefault();

    const cur = getPan();
    active = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: cur.x,
      startPanY: cur.y,
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  });
}

// Minimal long-press hook; keep API, don’t invent core types.
function bindLongPressMenu(_engine: Engine, boardRoot: HTMLElement) {
  // You can later wire a real context menu here.
  boardRoot.addEventListener("contextmenu", (e) => e.preventDefault());
}

/**
 * Stack drag + merge + open interactions.
 * (Keeps it tight: no unstack/split UX here yet.)
 */
function bindBoardInput(engine: Engine, boardRoot: HTMLElement, boardEl: HTMLElement, cfg: DonegeonConfig, counter: { firstDayOpenIndex: number }) {
  boardRoot.addEventListener("contextmenu", (e) => e.preventDefault());

  let drag: DragState = null;

  boardEl.addEventListener("pointerdown", (e) => {
    const pe = e as PointerEvent;
    const t = pe.target as HTMLElement;
    if ((t as HTMLElement).closest('[data-action="task-info"]')) return;

    const stackNode = t.closest(".sl-stack") as HTMLElement | null;
    if (!stackNode) return;

    if (pe.pointerType === "mouse" && pe.button === 2) return;

    const stackId = stackNode.dataset.stackId!;
    const s = engine.getStack(stackId);
    if (!s) return;

    const cardNode = t.closest(".sl-card") as HTMLElement | null;
    const idx = cardNode ? Number(cardNode.dataset.cardIndex ?? "-1") : -1;
    const cards = s.cards[0]();
    const topIdx = cards.length - 1;
    if (idx !== topIdx) return;

    engine.bringToFront(stackId);
    stackNode.setPointerCapture(pe.pointerId);

    const pan = getPan();
    const p = clientToBoard(pe.clientX, pe.clientY, boardRoot, pan);
    const sp = s.pos[0]();

    drag = {
      stackId,
      pointerId: pe.pointerId,
      offX: p.x - sp.x,
      offY: p.y - sp.y,
      startClientX: pe.clientX,
      startClientY: pe.clientY,
      moved: false,
    };
  });

  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (e.pointerId !== drag.pointerId) return;

    // mark as moved once we exceed slop
    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    if (!drag.moved && dx * dx + dy * dy > DRAG_CLICK_SLOP_PX * DRAG_CLICK_SLOP_PX) {
      drag.moved = true;
    }

    const s = engine.getStack(drag.stackId);
    if (!s) return;

    const pan = getPan();
    const p = clientToBoard(e.clientX, e.clientY, boardRoot, pan);
    s.pos[1]({ x: p.x - drag.offX, y: p.y - drag.offY });
  });

  boardEl.addEventListener("pointerup", (e) => {
    // If this pointerup is ending a drag that actually moved, do NOT treat as click/open.
    if (drag && e.pointerId === drag.pointerId && drag.moved) return;

    const path = (e.composedPath?.() ?? []) as EventTarget[];
    const infoBtn = path.find(
      (n): n is HTMLElement =>
        n instanceof HTMLElement && n.matches('[data-action="task-info"]')
    );

    if (infoBtn) {
      e.preventDefault();
      e.stopPropagation();

      const stackEl = infoBtn.closest(".sl-stack") as HTMLElement | null;
      if (!stackEl) return;

      const stackId = stackEl.dataset.stackId!;
      const cardEl = infoBtn.closest(".sl-card") as HTMLElement | null;
      const cardIndex = cardEl ? Number(cardEl.dataset.cardIndex ?? "-1") : -1;

      boardEl.dispatchEvent(
        new CustomEvent("donegeon:task-info", {
          bubbles: true,
          detail: { stackId, cardIndex },
        })
      );
      // openTaskModal({ engine, stackId });
      return;
    }

    // normal click handling (NOT info button)
    const t = e.target as HTMLElement;
    const stackEl = t.closest(".sl-stack") as HTMLElement | null;
    if (!stackEl) return;

    const stackId = stackEl.dataset.stackId!;
    const s = engine.getStack(stackId);
    if (!s) return;

    const top = s.topCard();
    if (!top) return;

    if (top.def.id === "deck.first_day") {
      const br = boardRoot.getBoundingClientRect();
      const cx = br.left + br.width * 0.55;
      const cy = br.top + br.height * 0.45;
      const p = clientToBoard(cx, cy, boardRoot, getPan());

      engine.createStack(snapToGrid(p.x, p.y), [spawn("deck.first_day_pack")]);
      return;
    }

    if (top.def.id === "deck.first_day_pack") {
      const seed = 1337 + counter.firstDayOpenIndex++;
      openPackFromDeck({
        cfg,
        engine,
        deckStackId: stackId,
        deckIdForDraws: "deck.first_day",
        seed,
      });
      return;
    }
  });

  window.addEventListener("pointerup", () => {
    if (!drag) return;

    const { stackId } = drag;
    const didMove = drag.moved;
    drag = null;

    const s = engine.getStack(stackId);
    if (!s) return;

    // snap
    const p = s.pos[0]();
    s.pos[1](snapToGrid(p.x, p.y));

    // merge only if it was a real drag
    if (didMove) {
      const target = bestMergeTarget(engine, stackId);
      if (target) {
        engine.mergeStacks(target, stackId);
        ensureTaskFaceCard(engine, target);
      }
    }
  });
}

export {
  bindMobilePan,
  bindLongPressMenu,
  bindBoardInput,
}

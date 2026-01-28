import type { Engine } from "../../../../frontend/packages/core";
import { snapToGrid } from "../../../../frontend/packages/core";
import { DonegeonConfig } from "../model/types";
import { clientToBoard } from "./geom.dom";
import { getPan, setPan, applyPan } from "./pan";
import { openPackFromDeck } from "./deck";
import { spawn } from "../model/catalog";

const MERGE_THRESHOLD_AREA = 92 * 40; // same spirit as legacy

type DragState = { stackId: string; pointerId: number; offX: number; offY: number } | null;

function stackNodeById(id: string): HTMLElement | null {
  return document.querySelector(`.sl-stack[data-stack-id="${id}"]`) as HTMLElement | null;
}

function rect(el: HTMLElement) {
  return el.getBoundingClientRect();
}

function bindDeckInteractions(engine: Engine, boardRoot: HTMLElement, boardEl: HTMLElement, cfg: DonegeonConfig, firstDayOpenIndex: number) {
  boardEl.addEventListener("pointerup", (e) => {
    const t = e.target as HTMLElement;
    const stackEl = t.closest(".sl-stack") as HTMLElement | null;
    if (!stackEl) return;

    const stackId = stackEl.dataset.stackId!;
    const s = engine.getStack(stackId);
    if (!s) return;

    const top = s.topCard();
    if (!top) return;

    // click First Day deck => spawn pack in center
    if (top.def.id === "deck.first_day") {
      const br = boardRoot.getBoundingClientRect();
      const cx = br.left + br.width * 0.55;
      const cy = br.top + br.height * 0.45;

      const pan = getPan();
      const p = clientToBoard(cx, cy, boardRoot, pan);

      engine.createStack(snapToGrid(p.x, p.y), [spawn("deck.first_day_pack")]);
      return;
    }

    // click pack => open from YAML draws
    if (top.def.id === "deck.first_day_pack") {
      // seed can later include account/day/etc
      const seed = 1337 + firstDayOpenIndex++;
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
    const t = e.target as HTMLElement;
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
 * Stack drag + merge.
 * (Keeps it tight: no unstack/split UX here yet.)
 */
function bindBoardInput(engine: Engine, boardRoot: HTMLElement, boardEl: HTMLElement) {
  boardRoot.addEventListener("contextmenu", (e) => e.preventDefault());

  let drag: DragState = null;

  boardEl.addEventListener("pointerdown", (e) => {
    const pe = e as PointerEvent;
    const t = pe.target as HTMLElement;

    const stackNode = t.closest(".sl-stack") as HTMLElement | null;
    if (!stackNode) return;

    // Ignore right-click on stacks (right-click is for panning empty space)
    if (pe.pointerType === "mouse" && pe.button === 2) return;

    const stackId = stackNode.dataset.stackId!;
    const s = engine.getStack(stackId);
    if (!s) return;

    // drag whole stack from top card only (prevents accidental grabs)
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

    drag = { stackId, pointerId: pe.pointerId, offX: p.x - sp.x, offY: p.y - sp.y };
  });

  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (e.pointerId !== drag.pointerId) return;

    const s = engine.getStack(drag.stackId);
    if (!s) return;

    const pan = getPan();
    const p = clientToBoard(e.clientX, e.clientY, boardRoot, pan);
    s.pos[1]({ x: p.x - drag.offX, y: p.y - drag.offY });
  });

  window.addEventListener("pointerup", () => {
    if (!drag) return;

    const stackId = drag.stackId;
    drag = null;

    const s = engine.getStack(stackId);
    if (!s) return;

    // snap
    const p = s.pos[0]();
    s.pos[1](snapToGrid(p.x, p.y));

    // merge?
    const target = bestMergeTarget(engine, stackId);
    if (target) {
      engine.mergeStacks(target, stackId);
    }
  });
}

export {
  bindMobilePan,
  bindDeckInteractions,
  bindLongPressMenu,
  bindBoardInput,
}
import type { Engine } from "../model/engine";
import { clientToBoard, snapToGrid } from "../core/geom";
import { showContextMenu, hideContextMenu } from "./contextmenu";
import type { DragState, PressState, PanState } from "../model/types";
import { getPan, setPan, applyPan } from "./pan";
import { unstackPositions } from "./physics";


const MERGE_THRESHOLD_AREA = 92 * 40;

let drag: DragState | null = null;
let press: PressState | null = null;
let activeStackId: string | null = null;
const panState: PanState = { active: false, pointers: new Map() };

function cancelDrag() {
  drag = null;
}
function isPanning() {
  return panState.active === true;
}


export function bindMobilePan(boardRoot: HTMLElement, boardEl: HTMLElement) {
  // allow us to handle gestures ourselves
  boardRoot.style.touchAction = "none";

  const canStartPan = (t: HTMLElement) => !t.closest(".sl-card") && !t.closest(".sl-stack");
  let mousePan: { active: boolean; startX: number; startY: number; startPanX: number; startPanY: number } | null = null;


  boardRoot.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse") return;
    if (e.button !== 2) return;

    const t = e.target as HTMLElement;
    if (!canStartPan(t)) return;

    e.preventDefault();
    clearPress();
    cancelDrag();
    hideContextMenu();

    const cur = getPan();
    mousePan = { active: true, startX: e.clientX, startY: e.clientY, startPanX: cur.x, startPanY: cur.y };
  });

  boardRoot.addEventListener("pointermove", (e) => {
    if (!mousePan?.active) return;
    const dx = e.clientX - mousePan.startX;
    const dy = e.clientY - mousePan.startY;
    setPan(mousePan.startPanX + dx, mousePan.startPanY + dy);
    applyPan(boardEl);
  });

  boardRoot.addEventListener("pointerup", () => { mousePan = null; });
  boardRoot.addEventListener("pointercancel", () => { mousePan = null; });
}


function clearPress() {
  if (!press) return;
  window.clearTimeout(press.timer);
  press = null;
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

export function bindLongPressMenu(engine: Engine, boardRoot: HTMLElement) {
  // Prevent the native context menu (especially on mobile long press)
  boardRoot.addEventListener("contextmenu", (e) => e.preventDefault());

  boardRoot.addEventListener("pointerdown", (e) => {
    const pe = e as PointerEvent;

    // Only touch/pen long-press
    if (pe.pointerType === "mouse") return;

    const hit = getStackAndIndexFromEventTarget(pe.target as HTMLElement);
    if (!hit) return;

    // Don’t long-press while dragging later (we cancel on move)
    clearPress();

    press = {
      pointerId: pe.pointerId,
      startX: pe.clientX,
      startY: pe.clientY,
      stackId: hit.stackId,
      cardIndex: hit.cardIndex,
      timer: window.setTimeout(() => {
        const s = engine.getStack(hit.stackId);
        const n = s ? s.cards[0]().length : 0;
        const origin = s ? s.pos[0]() : { x: 0, y: 0 };

        showContextMenu({
          root: boardRoot,
          clientX: pe.clientX,
          clientY: pe.clientY,
          items: [
            {
              label: "Unstack",
              disabled: n <= 1,
              onClick: () => {
                const s = engine.getStack(hit.stackId);
                if (!s) return;
                const n = s.cards[0]().length;
                const origin = s.pos[0]();
                engine.unstack(hit.stackId, unstackPositions(origin, n));
              }
            },
            {
              label: hit.cardIndex != null ? `Split here (${hit.cardIndex + 1})` : "Split here",
              disabled: hit.cardIndex == null || n <= 1 || hit.cardIndex >= n - 1,
              onClick: () => engine.splitStack(hit.stackId, hit.cardIndex!),
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
    if (dx * dx + dy * dy > 36) { // > 6px
      clearPress();
    }
  });

  boardRoot.addEventListener("pointerup", () => clearPress());
  boardRoot.addEventListener("pointercancel", () => clearPress());

  // If user starts other interactions, close menu
  boardRoot.addEventListener("pointerdown", () => hideContextMenu());
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

    const node = stackNodeById(id); // ✅ FIXED
    if (!node) continue;

    const score = intersectArea(dr, rect(node));
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }

  return bestScore >= MERGE_THRESHOLD_AREA ? best : null;
}


export function bindBoardInput(engine: Engine, boardRoot: HTMLElement, boardEl: HTMLElement) {
  // Prevent native context menu on the board
  boardRoot.addEventListener("contextmenu", (e) => e.preventDefault());

  boardEl.addEventListener("pointerdown", (e) => {
    const t = e.target as HTMLElement;
    const stackNode = t.closest(".sl-stack") as HTMLElement | null;
    if (!stackNode) return;


    // left click / touch only for drag in this minimal version
    const pe = e as PointerEvent;
    if (pe.button === 2) return;

    const stackId = stackNode.dataset.stackId!;
    const s = engine.stacks.get(stackId);
    if (!s) return;
    activeStackId = stackId;

    // detect card index
    const cardNode = t.closest(".sl-card") as HTMLElement | null;
    const idx = cardNode ? Number(cardNode.dataset.cardIndex ?? "-1") : -1;
    const topIdx = s.cards[0]().length - 1;

    if (pe.shiftKey && topIdx === 1 && idx === 1) {
      // stack is [0,1], shift-dragging top => pull bottom into a new stack
      const ns = engine.splitStack(stackId, 0); // new gets [0,1], old gets []
      // That’s not what we want, so instead:
      const ns2 = engine.splitStack(stackId, 1); // new gets [1], old keeps [0]
      if (ns2) startDrag(engine, ns2.id, pe, boardRoot);
      return;
    }

    // SHIFT-SPLIT: shift + drag a middle card => split and drag the new stack
    if (pe.shiftKey && idx >= 0 && idx < topIdx) {
      const ns = engine.splitStack(stackId, idx);
      if (ns) {
        // start dragging the new stack immediately
        startDrag(engine, ns.id, pe, boardRoot);
      }
      return;
    }

    // normal drag only allowed on TOP card
    if (idx !== topIdx) return;

    startDrag(engine, stackId, pe, boardRoot);
  });

  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (isPanning()) return;

    const s = engine.stacks.get(drag.stackId);
    if (!s) return;

    const p = clientToBoard(e.clientX, e.clientY, boardRoot);
    s.pos[1]({ x: p.x - drag.offX, y: p.y - drag.offY });
  });

  window.addEventListener("pointerup", () => {
    if (!drag) return;
    if (panState.active) { drag = null; return; }

    const id = drag.stackId;
    const s = engine.stacks.get(id);
    if (!s) {
      drag = null;
      return;
    }

    // snap
    const p = s.pos[0]();
    s.pos[1](snapToGrid(p.x, p.y));

    // optional merge on drop
    const target = bestMergeTarget(engine, id);
    if (target) {
      engine.mergeStacks(target, id);
    }

    drag = null;
  });

  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() !== "u") return;
    if (!activeStackId) return;

    const s = engine.getStack(activeStackId);
    if (!s) return;

    const n = s.cards[0]().length;
    if (n <= 1) return;

    const origin = s.pos[0]();
    engine.unstack(activeStackId, unstackPositions(origin, n));
    activeStackId = null;
  });

}

function startDrag(engine: Engine, stackId: string, e: PointerEvent, boardRoot: HTMLElement) {
  const s = engine.stacks.get(stackId);
  if (!s) return;

  engine.bringToFront(stackId);

  const node = document.querySelector(`.sl-stack[data-stack-id="${stackId}"]`) as HTMLElement | null;
  node?.setPointerCapture(e.pointerId);

  const p = clientToBoard(e.clientX, e.clientY, boardRoot);
  const sp = s.pos[0]();

  drag = { stackId, pointerId: e.pointerId, offX: p.x - sp.x, offY: p.y - sp.y };
}


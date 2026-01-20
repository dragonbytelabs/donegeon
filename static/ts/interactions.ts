import type { DragState, PressState, Stack } from "./types";
import { UNSTACK_RADIUS } from "./constants";
import { clientToBoard, snapToGrid, uid, $ } from "./geometry";
import { stacks, panX, panY, setPan, incrementZ } from "./state";
import { showContextMenu} from "./dom";
import { animateRelax, bestMergeTarget, splitFromIndex } from "./physics";
import { bringToFront, resolveCollisions, renderStack, renderAll } from "./dom";

let drag: DragState | null = null;
let press: PressState | null = null;

function clearPress() {
    if (!press) return;
    window.clearTimeout(press.timer);
    press = null;
}

function startLongPress(e: PointerEvent, stackId: string, cardIndex?: number) {
    // Only for touch/pen (mouse has right click)
    if (e.pointerType === "mouse") return;

    clearPress();

    press = {
        stackId,
        cardIndex,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        timer: window.setTimeout(() => {
            showContextMenu({
                clientX: e.clientX,
                clientY: e.clientY,
                stackId,
                cardIndex,
                onUnstack: (id) => unstackStack(id),
                onSplitHere: (id, idx) => splitFromIndex(id, idx),
            });
            clearPress();
        }, 450),
    };
}

type PanState = {
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
};
let pan: PanState | null = null;

export function onPointerDown(e: PointerEvent, stackNode: HTMLElement) {
    // ignore context menu opening drag; let contextmenu handler run separately
    if (e.button === 2) return;

    const stackId = stackNode.dataset.stackId!;
    const s = stacks.get(stackId);
    if (!s) return;

    const t = e.target as HTMLElement;

    // if they pressed on a specific card, we can compute idx for split menu
    const cardNode = t.closest(".sl-card") as HTMLElement | null;
    const idx = cardNode ? Number(cardNode.dataset.cardIndex ?? "0") : -1;

    // start long press on touch/pen (either on stack or on a card)
    startLongPress(e, stackId, idx >= 0 ? idx : undefined);

    // SHIFT split (desktop only)
    if (e.pointerType === "mouse" && e.shiftKey && idx >= 0 && idx < s.cards.length - 1) {
        splitFromIndex(stackId, idx);
        renderStack(s, onPointerDown); // see Patch 2: renderStack signature
        const newId = Array.from(stacks.keys()).at(-1); // better: have splitFromIndex return id
        if (newId) renderStack(stacks.get(newId)!, onPointerDown);
    }

    // Start drag from wherever user clicked (stack body or card)
    stackNode.setPointerCapture(e.pointerId);
    stackNode.style.zIndex = String(incrementZ());

    const p = clientToBoard(e.clientX, e.clientY);
    drag = { stackId, pointerId: e.pointerId, offX: p.x - s.x, offY: p.y - s.y };

    stackNode.style.transform = "translateZ(0) scale(1.02)";
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
}

export function initContextMenu() {
  window.addEventListener("stack:contextmenu", (e: any) => {
    const { stackId, clientX, clientY, cardIndex } = e.detail;
    showContextMenu({
      clientX,
      clientY,
      stackId,
      cardIndex: cardIndex >= 0 ? cardIndex : undefined,
      onUnstack: (id) => unstackStack(id),
      onSplitHere: (id, idx) => splitFromIndex(id, idx),
    });
  });
}

function onPointerMove(e: PointerEvent) {
    if (!drag) return;
    const s = stacks.get(drag.stackId);
    if (!s) return;

    // cancel long-press if finger moved
    if (press && e.pointerId === press.pointerId) {
        const dx = e.clientX - press.startX;
        const dy = e.clientY - press.startY;
        if (dx * dx + dy * dy > 36) { // >6px
            clearPress();
        }
    }

    const p = clientToBoard(e.clientX, e.clientY);
    s.x = p.x - drag.offX;
    s.y = p.y - drag.offY;

    const node = document.getElementById(drag.stackId);
    if (node) {
        node.style.left = `${s.x}px`;
        node.style.top = `${s.y}px`;
    }
}

async function onPointerUp() {
    window.removeEventListener("pointermove", onPointerMove);
    if (!drag) return;

    const draggedId = drag.stackId;
    const dragged = stacks.get(draggedId);
    const draggedNode = document.getElementById(draggedId) as HTMLElement | null;

    if (draggedNode) draggedNode.style.transform = "";

    if (!dragged) {
        drag = null;
        return;
    }

    // 1) snap to dots
    const snapped = snapToGrid(dragged.x, dragged.y);
    dragged.x = snapped.x;
    dragged.y = snapped.y;

    // 2) explicit merge attempt (your old logic)
    const targetId = bestMergeTarget(draggedId);

    if (targetId) {
        const target = stacks.get(targetId);
        if (target) {
            target.cards.push(...dragged.cards);

            stacks.delete(draggedId);
            document.getElementById(draggedId)?.remove();

            // re-render merged target + keep it on top
            renderStack(target, onPointerDown);
            bringToFront(targetId);

            drag = null;
            return;
        }
    }

    // 3) no merge => render snapped position and repel if overlapping
    renderStack(dragged, onPointerDown);
    bringToFront(draggedId);

    // IMPORTANT: use the wiggle/repel solver that pushes against ALL stacks
    // If your animateRelax already does that, keep it.
    await animateRelax([draggedId], 14);

    // final cleanup render (after any movement)
    const final = stacks.get(draggedId);
    if (final) {
        renderStack(final, onPointerDown);
        bringToFront(draggedId);
    }

    drag = null;
}


async function unstackStack(stackId: string) {
    const s = stacks.get(stackId);
    if (!s) return;
    if (s.cards.length <= 1) return;

    const originX = s.x;
    const originY = s.y;

    // remove original
    stacks.delete(stackId);
    document.getElementById(stackId)?.remove();

    const newIds: string[] = [];
    const n = s.cards.length;

    for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2;
        const rx = Math.cos(angle) * UNSTACK_RADIUS;
        const ry = Math.sin(angle) * (UNSTACK_RADIUS * 0.65);

        const ns: Stack = {
            id: uid("stack"),
            x: originX + rx,
            y: originY + ry,
            cards: [s.cards[i]],
        };

        const snapped = snapToGrid(ns.x, ns.y);
        ns.x = snapped.x;
        ns.y = snapped.y;

        stacks.set(ns.id, ns);
        newIds.push(ns.id);
    }

    // Render + bring the new ones to front (so they don't "disappear" behind something)
    for (const id of newIds) {
        const st = stacks.get(id);
        if (st) renderStack(st, onPointerDown);
        bringToFront(id);
    }

    // IMPORTANT: repel new cards from *everything* (not just each other)
    await resolveCollisions(newIds, 18);
    renderAll(onPointerDown);

    // Render again after adjustment
    for (const id of newIds) {
        const st = stacks.get(id);
        if (st) renderStack(st, onPointerDown);
        bringToFront(id);
    }
}


export function initBoardPanning(applyPanFn: (x: number, y: number) => void) {
    const root = $("boardRoot");
    root.addEventListener("contextmenu", (e) => e.preventDefault());

    root.addEventListener("pointerdown", (e) => {
        if (e.button !== 2) return;

        const t = e.target as HTMLElement;
        if (t.closest(".sl-card") || t.closest("button[data-action]")) return;

        e.preventDefault();
        e.stopPropagation();

        root.setPointerCapture(e.pointerId);
        pan = { pointerId: e.pointerId, startClientX: e.clientX, startClientY: e.clientY, startPanX: panX, startPanY: panY };

        window.addEventListener("pointermove", onPanMove);
        window.addEventListener("pointerup", onPanUp, { once: true });

        function onPanMove(ev: PointerEvent) {
            if (!pan) return;
            const dx = ev.clientX - pan.startClientX;
            const dy = ev.clientY - pan.startClientY;
            setPan(pan.startPanX + dx, pan.startPanY + dy);
            applyPanFn(panX, panY);
        }

        function onPanUp() {
            window.removeEventListener("pointermove", onPanMove);
            pan = null;
        }
    });
}

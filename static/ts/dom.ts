import type { Card, Stack } from "./types";
import { CARD_H, CARD_W, STACK_OFFSET_Y } from "./constants";
import { $, escapeHtml, snapToGrid } from "./geometry";
import { incrementZ, stacks } from "./state";
import { wiggleNode } from "./physics";
import { onPointerDown } from "./interactions";

let menuEl: HTMLDivElement | null = null;

function ensureMenu() {
  if (menuEl) return menuEl;
  menuEl = document.createElement("div");
  menuEl.id = "ctxMenu";
  menuEl.className =
    "fixed z-[9999] hidden min-w-[140px] rounded-md border border-border bg-card/95 p-1 text-sm shadow-lg backdrop-blur";
  document.body.appendChild(menuEl);

  // click anywhere closes
  window.addEventListener("pointerdown", () => hideContextMenu(), { capture: true });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideContextMenu();
  });

  return menuEl;
}

export function hideContextMenu() {
  if (!menuEl) return;
  menuEl.classList.add("hidden");
  menuEl.innerHTML = "";
  menuEl.dataset.stackId = "";
  menuEl.dataset.cardIndex = "";
}

export function showContextMenu(opts: {
  clientX: number;
  clientY: number;
  stackId: string;
  cardIndex?: number; // optional for "Split here"
  onUnstack: (stackId: string) => void;
  onSplitHere: (stackId: string, idx: number) => void;
}) {
  const el = ensureMenu();
  el.innerHTML = "";

  el.dataset.stackId = opts.stackId;
  el.dataset.cardIndex = String(opts.cardIndex ?? "");

  const addItem = (label: string, fn: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className =
      "block w-full rounded px-3 py-2 text-left hover:bg-accent";
    b.textContent = label;
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideContextMenu();
      fn();
    });
    el.appendChild(b);
  };

  addItem("Unstack", () => opts.onUnstack(opts.stackId));

  if (typeof opts.cardIndex === "number" && opts.cardIndex >= 0) {
    addItem("Split here", () => opts.onSplitHere(opts.stackId, opts.cardIndex!));
  }

  addItem("Cancel", () => { });

  el.style.left = `${opts.clientX + 6}px`;
  el.style.top = `${opts.clientY + 6}px`;
  el.classList.remove("hidden");
}

function stackHeight(n: number) {
  return CARD_H + Math.max(0, n - 1) * STACK_OFFSET_Y;
}

export function bringToFront(stackId: string) {
  const node = document.getElementById(stackId) as HTMLElement | null;
  if (!node) return;
  node.style.zIndex = String(incrementZ());
}

/**
 * Resolve collisions for "focus" stacks vs ALL stacks.
 * Moves only the focus stacks (so existing stacks stay put).
 */
export async function resolveCollisions(focusIds: string[], frames: number) {
  const focus = new Set(focusIds);

  for (let f = 0; f < frames; f++) {
    let any = false;

    const allIds = Array.from(stacks.keys());

    for (const aId of focusIds) {
      const a = stacks.get(aId);
      if (!a) continue;

      for (const bId of allIds) {
        if (bId === aId) continue;

        const b = stacks.get(bId);
        if (!b) continue;

        const ah = stackHeight(a.cards.length);
        const bh = stackHeight(b.cards.length);

        const ax1 = a.x, ay1 = a.y, ax2 = a.x + CARD_W, ay2 = a.y + ah;
        const bx1 = b.x, by1 = b.y, bx2 = b.x + CARD_W, by2 = b.y + bh;

        const overlapX = Math.min(ax2, bx2) - Math.max(ax1, bx1);
        const overlapY = Math.min(ay2, by2) - Math.max(ay1, by1);

        if (overlapX > 0 && overlapY > 0) {
          any = true;

          const acx = a.x + CARD_W / 2;
          const acy = a.y + ah / 2;
          const bcx = b.x + CARD_W / 2;
          const bcy = b.y + bh / 2;

          let dx = acx - bcx;
          let dy = acy - bcy;
          if (dx === 0 && dy === 0) dx = 1;

          const len = Math.sqrt(dx * dx + dy * dy);
          dx /= len;
          dy /= len;

          // smaller push per frame so it "wiggles away"
          const push = Math.max(overlapX, overlapY) * 0.12 + 1.2;

          a.x += dx * push;
          a.y += dy * push;

          // if the other is also focus, push it too (keeps symmetry)
          if (focus.has(bId)) {
            b.x -= dx * push;
            b.y -= dy * push;
          }

          // wiggle on first few frames so it’s visible
          if (f < 4) {
            wiggleNode(aId);
            wiggleNode(bId);
          }
        }
      }
    }

    // update DOM positions without re-rendering everything
    for (const id of focusIds) {
      const s = stacks.get(id);
      const node = document.getElementById(id) as HTMLElement | null;
      if (s && node) {
        node.style.left = `${s.x}px`;
        node.style.top = `${s.y}px`;
      }
    }

    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    if (!any) break;
  }

  // final snap + full render for clean layout
  for (const id of focusIds) {
    const s = stacks.get(id);
    if (!s) continue;
    const sn = snapToGrid(s.x, s.y);
    s.x = sn.x;
    s.y = sn.y;
    renderStack(s, onPointerDown);
    bringToFront(id);
  }
}


export function createCardEl(card: Card, idx: number, isTop: boolean): HTMLElement {
  const el = document.createElement("div");
  el.className = `sl-card ${card.kind}` + (isTop ? " sl-top" : "");
  el.dataset.cardId = card.id;
  el.dataset.cardIndex = String(idx);
  el.style.position = "absolute";
  el.style.left = "0px";
  el.style.top = `${idx * STACK_OFFSET_Y}px`;

  el.innerHTML = `
    <div class="sl-card__title">${escapeHtml(card.title)}</div>
    <div class="sl-card__body">
      <div class="sl-card__icon">
        <span style="font-size:18px;opacity:.85">${escapeHtml(card.icon ?? "⬤")}</span>
      </div>
    </div>
    ${card.leftBadge ? `<div class="sl-badge sl-badge--left">${escapeHtml(card.leftBadge)}</div>` : ""}
    ${card.rightBadge ? `<div class="sl-badge sl-badge--right">${escapeHtml(card.rightBadge)}</div>` : ""}
  `;
  return el;
}

export function renderStack(s: Stack, onPointerDown: any) {
  const board = $("board");
  let node = document.getElementById(s.id) as HTMLElement | null;

  if (!node) {
    node = document.createElement("div");
    node.id = s.id;
    node.className = "sl-stack";
    node.dataset.stackId = s.id;
    node.style.zIndex = String(incrementZ());
    node.style.position = "absolute";
    board.appendChild(node);

    node.addEventListener("pointerdown", (e) => onPointerDown(e as PointerEvent, node!));
    // node.addEventListener("click", (e) => onStackClick(e));
    // node.addEventListener("pointerdown", (e) => onHandlePointerDown(e as PointerEvent));
  }

  node.style.left = `${s.x}px`;
  node.style.top = `${s.y}px`;
  node.style.width = `${CARD_W}px`;
  node.style.height = `${stackHeight(s.cards.length)}px`;
  node.style.overflow = "visible";
  node.style.touchAction = "none";

  node.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const t = e.target as HTMLElement;
    const card = t.closest(".sl-card") as HTMLElement | null;
    const idx = card ? Number(card.dataset.cardIndex ?? "-1") : -1;

    window.dispatchEvent(new CustomEvent("stack:contextmenu", {
      detail: { stackId: s.id, clientX: (e as MouseEvent).clientX, clientY: (e as MouseEvent).clientY, cardIndex: idx },
    }));
  });

  node.innerHTML = "";

  s.cards.forEach((c, idx) => {
    const isTop = idx === s.cards.length - 1;
    node!.appendChild(createCardEl(c, idx, isTop));
  });
}

export function renderAll(onPointerDown: any) {
  for (const s of stacks.values()) {
    renderStack(s, onPointerDown);
  }
}

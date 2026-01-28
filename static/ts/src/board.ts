type Pan = { x: number; y: number };

function mustEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id) as T | null;
  if (!el) throw new Error(`Missing element: #${id}`);
  return el;
}

function cssPx(el: HTMLElement, name: string, fallback: number): number {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  const n = Number(raw.replace("px", ""));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function applyPan(boardEl: HTMLElement, pan: Pan) {
  boardEl.style.transform = `translate(${pan.x}px, ${pan.y}px)`;
}

/**
 * Panning rules:
 * - Desktop: RIGHT mouse drag on empty space.
 * - Touch/pen: drag on empty space pans.
 */
function bindPan(boardRoot: HTMLElement, boardEl: HTMLElement) {
  boardRoot.style.touchAction = "none"; // prevent browser scroll hijack
  boardRoot.addEventListener("contextmenu", (e) => e.preventDefault());

  let pan: Pan = { x: 0, y: 0 };
  let active:
    | { pointerId: number; startX: number; startY: number; startPanX: number; startPanY: number }
    | null = null;

  const canStartPan = (t: HTMLElement) => !t.closest(".sl-card") && !t.closest(".sl-stack");

  function onMove(e: PointerEvent) {
    if (!active || e.pointerId !== active.pointerId) return;
    e.preventDefault();
    const dx = e.clientX - active.startX;
    const dy = e.clientY - active.startY;
    pan = { x: active.startPanX + dx, y: active.startPanY + dy };
    applyPan(boardEl, pan);
  }

  function onUp(e: PointerEvent) {
    if (!active || e.pointerId !== active.pointerId) return;
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

    active = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  });
}

/**
 * Demo: create one stack so you can confirm CSS + offsets are correct.
 * Later this will be replaced by server-rendered stacks.
 */
function mountDemoStack(boardEl: HTMLElement, cfg: { cardW: number; cardH: number; offY: number }) {
  const stack = document.createElement("div");
  stack.className = "sl-stack";
  stack.dataset.stackId = "demo-1";
  stack.style.position = "absolute";
  stack.style.left = "380px";
  stack.style.top = "220px";
  stack.style.overflow = "visible";
  stack.style.width = `${cfg.cardW}px`;
  stack.style.height = `${cfg.cardH + (3 - 1) * cfg.offY}px`;

  const cards = [
    { title: "Task: Inbox", skin: "sl-kind-blank", icon: "📝", left: "1", right: "" },
    { title: "Next Action", skin: "sl-kind-quest", icon: "➡️", left: "ACT", right: "" },
    { title: "Deadline", skin: "sl-kind-coin", icon: "⏰", left: "DUE", right: "" },
  ];

  cards.forEach((c, idx) => {
    const isTop = idx === cards.length - 1;
    const el = document.createElement("div");
    el.className = `sl-card ${c.skin}` + (isTop ? " sl-top" : "");
    el.dataset.cardIndex = String(idx);
    el.style.position = "absolute";
    el.style.left = "0px";
    el.style.top = `${idx * cfg.offY}px`;

    el.innerHTML = `
      <div class="sl-card__title">${c.title}</div>
      <div class="sl-card__body">
        <div class="sl-card__icon"><span style="font-size:18px;opacity:.85">${c.icon}</span></div>
      </div>
      ${c.left ? `<div class="sl-badge sl-badge--left">${c.left}</div>` : ""}
      ${c.right ? `<div class="sl-badge sl-badge--right">${c.right}</div>` : ""}
    `;

    stack.appendChild(el);
  });

  boardEl.appendChild(stack);
}

document.addEventListener("DOMContentLoaded", () => {
  const boardRoot = mustEl<HTMLElement>("boardRoot");
  const boardEl = mustEl<HTMLElement>("board");

  // Read runtime UI numbers (templ injects these from donegeon.config.yaml ui.board)
  const grid = cssPx(boardRoot, "--ui-grid", 22);
  const cardW = cssPx(boardRoot, "--ui-card-w", 92);
  const cardH = cssPx(boardRoot, "--ui-card-h", 124);
  const offY = cssPx(boardRoot, "--ui-stack-off-y", 20);

  console.log("[board] ui", { grid, cardW, cardH, offY });

  bindPan(boardRoot, boardEl);
  mountDemoStack(boardEl, { cardW, cardH, offY });
});

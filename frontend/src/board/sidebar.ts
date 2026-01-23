// frontend/src/board/sidebar.ts
import type { Engine } from "../model/engine";
import { spawn } from "../model/catalog";
import { clientToBoard, snapToGrid } from "../core/geom";
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

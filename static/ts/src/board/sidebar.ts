import type { Engine } from "../../../../frontend/packages/core";
import { snapToGrid } from "../../../../frontend/packages/core";
import { spawn, type DonegeonDefId } from "../model/catalog";
import { clientToBoard } from "./geom.dom";
import { getPan } from "./pan";

function qs<T extends Element>(sel: string) {
  return document.querySelector(sel) as T | null;
}

export function initShell(engine: Engine, boardRoot: HTMLElement) {
  const sidebarToggle = qs<HTMLButtonElement>("#sidebarToggle");
  const sidebar = qs<HTMLElement>("#sidebar");
  const backdrop = qs<HTMLElement>("#sidebarBackdrop");

  // If you don’t have a sidebar yet, safely no-op.
  if (!sidebar) return;

  function isSidebarOpen() {
    return !sidebar?.classList.contains("-translate-x-full");
  }

  function closeSidebar() {
    sidebar?.classList.add("-translate-x-full");
    backdrop?.classList.add("hidden");
  }

  function toggleSidebar() {
    if (isSidebarOpen()) closeSidebar();
    else {
      sidebar?.classList.remove("-translate-x-full");
      backdrop?.classList.remove("hidden");
    }
  }

  sidebarToggle?.addEventListener("click", toggleSidebar);
  backdrop?.addEventListener("click", closeSidebar);

  // click-spawn support
  sidebar.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const btn = t.closest("button[data-spawn]") as HTMLButtonElement | null;
    if (!btn) return;

    const defId = btn.dataset.spawn as DonegeonDefId | undefined;
    if (!defId) return;

    const br = boardRoot.getBoundingClientRect();
    const cx = br.left + br.width * 0.55;
    const cy = br.top + br.height * 0.35;

    const pan = getPan();
    const p = clientToBoard(cx, cy, boardRoot, pan);

    engine.createStack(snapToGrid(p.x, p.y), [spawn(defId)]);
    if (window.matchMedia("(max-width: 768px)").matches) closeSidebar();
  });
}

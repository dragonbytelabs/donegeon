import { applyPan } from "./geometry";
import { panX, panY } from "./state";
import { initShell, seed } from "./seed";
import { renderAll } from "./dom";
import { initBoardPanning, initContextMenu, onPointerDown } from "./interactions";

document.addEventListener("DOMContentLoaded", () => {
  initShell();

  initBoardPanning((x, y) => applyPan(x, y));
  initContextMenu();
  applyPan(panX, panY);

  seed();
  renderAll(onPointerDown);
});

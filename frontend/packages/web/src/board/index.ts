import { Engine } from "@donegeon/core";
import { mountBoard } from "./render";
import { bindMobilePan, bindBoardInput, bindLongPressMenu } from "./input";
import { initShell } from "./sidebar";
import { applyPan } from "./pan";
import { openTaskModal } from "./taskModal";
import { scheduleLiveSync } from "./liveSync";
import { scheduleSave } from "./storage";
import { applyBoardState, cmdBoardSeedDefault, fetchBoardState } from "./api";
import { loadInventory } from "./inventory";

// Get bottom deck row Y position based on viewport
function getDeckRowY(): number {
  const boardRoot = document.getElementById("boardRoot");
  if (!boardRoot) return 500;
  // Position decks 140px from bottom to leave room for deck row UI
  return boardRoot.clientHeight - 140;
}

// Setup mobile goals menu toggle
function setupGoalsMenu() {
  const toggle = document.getElementById("goalsMenuToggle");
  const sidebar = document.getElementById("goalsSidebarMobile");
  const backdrop = document.getElementById("goalsBackdrop");

  if (!toggle || !sidebar || !backdrop) return;

  const openMenu = () => {
    sidebar.classList.remove("-translate-x-full");
    backdrop.classList.remove("hidden");
  };

  const closeMenu = () => {
    sidebar.classList.add("-translate-x-full");
    backdrop.classList.add("hidden");
  };

  toggle.addEventListener("click", openMenu);
  backdrop.addEventListener("click", closeMenu);
}

document.addEventListener("DOMContentLoaded", async () => {
  const boardRoot = document.getElementById("boardRoot")!;
  const boardEl = document.getElementById("board")!;

  applyPan(boardEl);
  setupGoalsMenu();
  loadInventory();

  const engine = new Engine();
  let serverState = await fetchBoardState();
  if (Object.keys(serverState.stacks).length === 0) {
    await cmdBoardSeedDefault(getDeckRowY());
    serverState = await fetchBoardState();
  }
  applyBoardState(engine, serverState);

  mountBoard(engine, boardEl);
  initShell(engine, boardRoot);
  bindMobilePan(boardRoot, boardEl);
  bindBoardInput(engine, boardRoot, boardEl);
  bindLongPressMenu(engine, boardRoot);

  // Handle task-info events emitted by render.ts
  boardRoot.addEventListener("donegeon:task-info", (e) => {
    const ev = e as CustomEvent<{ stackId: string; cardIndex: number }>;
    const { stackId, cardIndex } = ev.detail;

    console.log(">>>>>> look here: ", { engine, stackId, cardIndex });
    void openTaskModal({ engine, stackId, cardIndex });
  });

  // Set up auto-save on engine events
  engine.events.on(() => scheduleSave(engine));

  scheduleLiveSync(engine, 0);

  (window as any).__engine = engine;
});

import { Engine, snapToGrid } from "@donegeon/core";
import { spawn } from "../model/catalog";
import { mountBoard } from "./render";
import { bindMobilePan, bindBoardInput, bindLongPressMenu } from "./input";
import { initShell } from "./sidebar";
import { applyPan } from "./pan";
import { loadConfig } from "./utils";
import { openTaskModal } from "./taskModal";
import { scheduleLiveSync } from "./liveSync";
import { loadBoard, scheduleSave, hydrateEngine } from "./storage";
import { syncBoardState } from "./api";
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
  const counter = { firstDayOpenIndex: 0 };
  const cfg = await loadConfig();

  const boardRoot = document.getElementById("boardRoot")!;
  const boardEl = document.getElementById("board")!;

  applyPan(boardEl);
  setupGoalsMenu();
  loadInventory();

  const engine = new Engine();

  // Load saved state BEFORE seeding
  const savedBoard = await loadBoard();

  if (savedBoard) {
    hydrateEngine(engine, savedBoard);

    // Ensure Collect deck exists (added in later version)
    let hasCollectDeck = false;
    for (const stack of engine.stacks.values()) {
      const top = stack.topCard();
      if (top?.def.id === "deck.collect") {
        hasCollectDeck = true;
        break;
      }
    }
    if (!hasCollectDeck) {
      const deckY = getDeckRowY();
      engine.createStack(snapToGrid(170, deckY), [spawn("deck.collect")]);
    }
  } else {
    // First run: seed default content
    // Position decks in a row at the bottom
    const deckY = getDeckRowY();
    const deckStartX = 60;
    const deckSpacing = 110;

    engine.createStack(snapToGrid(deckStartX, deckY), [spawn("deck.first_day")]);
    engine.createStack(snapToGrid(deckStartX + deckSpacing, deckY), [spawn("deck.collect")]);
    engine.createStack(snapToGrid(deckStartX + deckSpacing * 2, deckY), [spawn("deck.organization")]);
    engine.createStack(snapToGrid(deckStartX + deckSpacing * 3, deckY), [spawn("deck.survival")]);

    // Villagers in the play area
    engine.createStack(snapToGrid(300, 200), [spawn("villager.basic", { name: "Flicker" })]);
    engine.createStack(snapToGrid(420, 200), [spawn("villager.basic", { name: "Pip" })]);
  }

  mountBoard(engine, boardEl);
  initShell(engine, boardRoot);
  bindMobilePan(boardRoot, boardEl);
  bindBoardInput(engine, boardRoot, boardEl, cfg, counter);
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

  // Sync initial state to server
  syncBoardState(engine).catch((err) => {
    console.warn("initial board sync failed", err);
  });

  scheduleLiveSync(engine, 0);

  (window as any).__engine = engine;
});

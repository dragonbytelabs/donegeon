import { Engine, snapToGrid } from "../../../../frontend/packages/core";
import { spawn } from "../model/catalog";
import { mountBoard } from "./render";
import { bindMobilePan, bindBoardInput, bindLongPressMenu } from "./input";
import { initShell } from "./sidebar";
import { applyPan } from "./pan";
import { loadConfig } from "./utils";
import { openTaskModal } from "./taskModal"; // ✅ add this

document.addEventListener("DOMContentLoaded", async () => {
  const counter = { firstDayOpenIndex: 0 };
  const cfg = await loadConfig();

  const boardRoot = document.getElementById("boardRoot")!;
  const boardEl = document.getElementById("board")!;

  applyPan(boardEl);

  const engine = new Engine();

  mountBoard(engine, boardEl);
  initShell(engine, boardRoot);
  bindMobilePan(boardRoot, boardEl);
  bindBoardInput(engine, boardRoot, boardEl, cfg, counter);
  bindLongPressMenu(engine, boardRoot);

  // ✅ handle task-info events emitted by render.ts
  boardRoot.addEventListener("donegeon:task-info", (e) => {
    const ev = e as CustomEvent<{ stackId: string; cardIndex: number }>;
    const { stackId, cardIndex } = ev.detail;

    console.log(">>>>>> look here: ", { engine, stackId, cardIndex });
    void openTaskModal({ engine, stackId, cardIndex });
  });

  // Seed: decks
  engine.createStack(snapToGrid(80, 250), [spawn("deck.first_day")]);
  engine.createStack(snapToGrid(80, 410), [spawn("deck.organization")]);
  engine.createStack(snapToGrid(80, 570), [spawn("deck.survival")]);

  // Seed: villagers
  engine.createStack(snapToGrid(420, 420), [spawn("villager.basic", { name: "Flicker" })]);
  engine.createStack(snapToGrid(540, 420), [spawn("villager.basic", { name: "Pip" })]);

  (window as any).__engine = engine;
});

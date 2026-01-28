import { Engine, snapToGrid } from "../../../../frontend/packages/core";
import { spawn } from "../model/catalog";
import { mountBoard } from "./render";
import { bindMobilePan, bindBoardInput, bindLongPressMenu } from "./input";
import { initShell } from "./sidebar";
import { applyPan } from "./pan";
import { loadConfig } from "./utils";

document.addEventListener("DOMContentLoaded", async () => {
    const counter = {
        firstDayOpenIndex: 0
    };

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

    // Seed: 4 decks
    engine.createStack(snapToGrid(80, 250), [spawn("deck.first_day")]);
    engine.createStack(snapToGrid(80, 410), [spawn("deck.organization")]);
    engine.createStack(snapToGrid(80, 570), [spawn("deck.survival")]);

    // Seed: 2 villagers
    engine.createStack(snapToGrid(420, 420), [spawn("villager.basic", { name: "Flicker" })]);
    engine.createStack(snapToGrid(540, 420), [spawn("villager.basic", { name: "Pip" })]);

    (window as any).__engine = engine;
});

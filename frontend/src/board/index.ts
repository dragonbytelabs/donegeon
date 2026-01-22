import { Engine } from "../model/engine";
import { mountBoard } from "./render";
import { bindMobilePan, bindBoardInput, bindLongPressMenu } from "./input";
import { spawn } from "../model/catalog";
import { initShell } from "./sidebar";
import { applyPan } from "./pan";


document.addEventListener("DOMContentLoaded", () => {
  const boardRoot = document.getElementById("boardRoot")!;
  const boardEl = document.getElementById("board")!;

  applyPan(boardEl);

  const engine = new Engine();

  mountBoard(engine, boardEl);
  initShell();
  bindMobilePan(boardRoot, boardEl);
  bindBoardInput(engine, boardRoot, boardEl);
  bindLongPressMenu(engine, document.getElementById("boardRoot")!);

  // Seed demo stacks
  engine.createStack({ x: 380, y: 220 }, [spawn("event.create_user_submission")]);
  engine.createStack({ x: 560, y: 210 }, [spawn("agent.ai_tools")]);
  engine.createStack({ x: 770, y: 180 }, [spawn("integration.slack"), spawn("integration.entra"), spawn("integration.jira")]);

  // Expose for debugging in devtools if you want
  (window as any).__engine = engine;
});

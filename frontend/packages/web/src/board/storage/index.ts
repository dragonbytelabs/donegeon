import type { IDBPDatabase } from "idb";
import type { Engine } from "@donegeon/core";
import { initDB } from "./db";
import { serializeEngine } from "./serialize";
import type { BoardSnapshot, DonegeonDB } from "./schema";

export { hydrateEngine } from "./hydrate";
export type { BoardSnapshot } from "./schema";

let db: IDBPDatabase<DonegeonDB> | null = null;
let saveTimer: number | null = null;

export async function initStorage(): Promise<void> {
  if (!db) {
    db = await initDB();
  }
}

export async function loadBoard(boardId = "default"): Promise<BoardSnapshot | null> {
  await initStorage();
  if (!db) return null;

  const snapshot = await db.get("boards", boardId);
  return snapshot ?? null;
}

export async function saveBoard(engine: Engine, boardId = "default"): Promise<void> {
  await initStorage();
  if (!db) return;

  const snapshot = serializeEngine(engine, boardId);
  await db.put("boards", snapshot);
}

export function scheduleSave(engine: Engine, delayMs = 300): void {
  if (saveTimer != null) window.clearTimeout(saveTimer);

  saveTimer = window.setTimeout(async () => {
    saveTimer = null;
    try {
      await saveBoard(engine);
    } catch (e) {
      console.warn("board save failed", e);
    }
  }, delayMs);
}

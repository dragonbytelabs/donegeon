// Board API client

import { CardEntity, StackEntity, type Engine } from "@donegeon/core";
import { donegeonDefs, type DonegeonDefId } from "../model/catalog";

export interface SerializedCard {
  id: string;
  defId: string;
  data: Record<string, unknown>;
}

export interface SerializedStack {
  id: string;
  pos: { x: number; y: number };
  z: number;
  cards: string[]; // Card IDs (resolved via BoardStateResponse.cards)
}

export interface BoardStateResponse {
  stacks: Record<string, SerializedStack>;
  cards: Record<string, SerializedCard>;
  version: string;
}

export interface CommandResponse {
  ok: boolean;
  newVersion: string;
  patch?: unknown;
  error?: string;
}

const API_BASE = "/api/board";
let boardVersion = "";

export function getBoardVersion(): string {
  return boardVersion;
}

function setBoardVersion(version: string | undefined): void {
  if (typeof version === "string" && version.trim() !== "") {
    boardVersion = version;
  }
}

function readCard(state: BoardStateResponse, cardId: string): SerializedCard {
  const c = state.cards[cardId];
  if (!c) {
    return {
      id: cardId,
      defId: "task.blank",
      data: {},
    };
  }
  return c;
}

export function applyBoardState(engine: Engine, state: BoardStateResponse): void {
  const nextIDs = new Set(Object.keys(state.stacks));
  const existingIDs = Array.from(engine.stacks.keys());
  for (const stackId of existingIDs) {
    if (!nextIDs.has(stackId)) {
      engine.removeStack(stackId);
    }
  }

  const orderedStacks = Object.values(state.stacks).sort((a, b) => a.z - b.z);
  let maxZ = 10;

  for (const stackData of orderedStacks) {
    const cards = stackData.cards.map((cardId) => readCard(state, cardId)).map((card) => {
      const def = donegeonDefs[card.defId as DonegeonDefId] ?? donegeonDefs["task.blank"];
      return new CardEntity(card.id, def, card.data ?? {});
    });
    if (!cards.length) continue;

    const existing = engine.getStack(stackData.id);
    if (existing) {
      existing.pos[1]({ ...stackData.pos });
      existing.z[1](stackData.z);
      existing.cards[1](cards);
    } else {
      const stack = new StackEntity(stackData.id, stackData.pos, cards);
      stack.z[1](stackData.z);
      engine.addStack(stack);
    }

    maxZ = Math.max(maxZ, stackData.z);
  }

  const serverVersion = Number.parseInt(state.version, 10);
  if (Number.isFinite(serverVersion)) {
    maxZ = Math.max(maxZ, serverVersion);
  }
  engine.setMaxZ(maxZ);
  setBoardVersion(state.version);
}

export async function fetchBoardState(boardId = "default"): Promise<BoardStateResponse> {
  const res = await fetch(`${API_BASE}/state?board=${boardId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch board state: ${res.status}`);
  }
  const data: BoardStateResponse = await res.json();
  setBoardVersion(data.version);
  return data;
}

export async function reloadBoard(engine: Engine, boardId = "default"): Promise<BoardStateResponse> {
  const state = await fetchBoardState(boardId);
  applyBoardState(engine, state);
  return state;
}

async function parseJSONSafe(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export async function sendCommand(
  cmd: string,
  args: Record<string, unknown>,
  boardId = "default"
): Promise<CommandResponse> {
  const clientVersion = getBoardVersion();
  const res = await fetch(`${API_BASE}/cmd?board=${boardId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cmd,
      args,
      clientVersion: clientVersion || undefined,
    }),
  });

  const data = await parseJSONSafe(res);
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Command failed: ${res.status}`);
  }
  setBoardVersion(data.newVersion);
  return data;
}

// Convenience methods for specific commands

export function cmdStackMove(stackId: string, x: number, y: number) {
  return sendCommand("stack.move", { stackId, x, y });
}

export function cmdStackBringToFront(stackId: string) {
  return sendCommand("stack.bringToFront", { stackId });
}

export function cmdStackMerge(targetId: string, sourceId: string) {
  return sendCommand("stack.merge", { targetId, sourceId });
}

export function cmdStackSplit(
  stackId: string,
  index: number,
  offsetX = 12,
  offsetY = 12,
  newX?: number,
  newY?: number
) {
  return sendCommand("stack.split", { stackId, index, offsetX, offsetY, newX, newY });
}

export function cmdStackUnstack(stackId: string, positions: { x: number; y: number }[]) {
  return sendCommand("stack.unstack", { stackId, positions });
}

export function cmdStackRemove(stackId: string) {
  return sendCommand("stack.remove", { stackId });
}

export function cmdTaskCreateBlank(x: number, y: number) {
  return sendCommand("task.create_blank", { x, y });
}

export function cmdBoardSeedDefault(deckRowY: number) {
  return sendCommand("board.seed_default", { deckRowY });
}

export function cmdCardSpawn(defId: string, x: number, y: number, data: Record<string, unknown> = {}) {
  return sendCommand("card.spawn", { defId, x, y, data });
}

export function cmdDeckSpawnPack(
  deckStackId: string,
  x: number,
  y: number,
  packDefId = "deck.first_day_pack"
) {
  return sendCommand("deck.spawn_pack", { deckStackId, x, y, packDefId });
}

export function cmdDeckOpenPack(packStackId: string, deckId: string, radius = 170) {
  return sendCommand("deck.open_pack", { packStackId, deckId, radius });
}

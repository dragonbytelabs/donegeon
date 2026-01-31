// Board API client

import type { Engine } from "@donegeon/core";

export interface SerializedCard {
  id: string;
  defId: string;
  data: Record<string, unknown>;
}

export interface SerializedStack {
  id: string;
  pos: { x: number; y: number };
  z: number;
  cards: string[]; // Card IDs
}

// For syncing to server (includes full card data)
export interface SyncStack {
  id: string;
  pos: { x: number; y: number };
  z: number;
  cards: SerializedCard[];
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

export async function fetchBoardState(boardId = "default"): Promise<BoardStateResponse> {
  const res = await fetch(`${API_BASE}/state?board=${boardId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch board state: ${res.status}`);
  }
  return res.json();
}

export async function sendCommand(
  cmd: string,
  args: Record<string, unknown>,
  boardId = "default"
): Promise<CommandResponse> {
  const res = await fetch(`${API_BASE}/cmd?board=${boardId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cmd, args }),
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Command failed: ${res.status}`);
  }
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

export function cmdStackSplit(stackId: string, index: number, offsetX = 12, offsetY = 12) {
  return sendCommand("stack.split", { stackId, index, offsetX, offsetY });
}

export function cmdStackUnstack(stackId: string, positions: { x: number; y: number }[]) {
  return sendCommand("stack.unstack", { stackId, positions });
}

export function cmdTaskCreateBlank(x: number, y: number) {
  return sendCommand("task.create_blank", { x, y });
}

// Sync entire board state to server
export async function syncBoardState(engine: Engine, boardId = "default"): Promise<void> {
  const stacks: SyncStack[] = [];

  for (const [id, stack] of engine.stacks) {
    stacks.push({
      id,
      pos: { ...stack.pos[0]() },
      z: stack.z[0](),
      cards: stack.cards[0]().map((card) => ({
        id: card.id,
        defId: card.def.id,
        data: { ...card.data },
      })),
    });
  }

  const res = await fetch(`${API_BASE}/state?board=${boardId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stacks, maxZ: engine.getMaxZ() }),
  });

  if (!res.ok) {
    throw new Error(`Failed to sync board state: ${res.status}`);
  }
}

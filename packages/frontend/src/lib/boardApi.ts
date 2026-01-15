import type { BoardEventDto, BoardStateDto } from "@donegeon/app/api";
import { apiGetWithHeaders, apiPostWithHeaders } from "./api";
import { getPlayerId } from "./playerId";

function playerHeaders() {
  return { "X-Donegeon-Player": getPlayerId() };
}

export async function boardGetState(): Promise<BoardStateDto> {
  return await apiGetWithHeaders("/api/board/state", playerHeaders());
}

export async function boardSpawnDeck(deckId: string): Promise<{ state: BoardStateDto; events: BoardEventDto[] }> {
  return await apiPostWithHeaders("/api/board/spawn-deck", { deck_id: deckId }, playerHeaders());
}

export async function boardMove(entityId: string, x: number, y: number): Promise<{ state: BoardStateDto; events: BoardEventDto[] }> {
  return await apiPostWithHeaders("/api/board/move", { entity_id: entityId, x, y }, playerHeaders());
}

export async function boardStack(sourceId: string, targetId: string): Promise<{ state: BoardStateDto; events: BoardEventDto[] }> {
  return await apiPostWithHeaders("/api/board/stack", { source_id: sourceId, target_id: targetId }, playerHeaders());
}

export async function boardUnstack(stackId: string): Promise<{ state: BoardStateDto; events: BoardEventDto[] }> {
  return await apiPostWithHeaders("/api/board/unstack", { stack_id: stackId }, playerHeaders());
}

export async function boardOpenDeck(deckEntityId: string): Promise<{ state: BoardStateDto; events: BoardEventDto[] }> {
  return await apiPostWithHeaders("/api/board/open-deck", { deck_entity_id: deckEntityId }, playerHeaders());
}

export async function boardCollect(entityId: string): Promise<{ state: BoardStateDto; events: BoardEventDto[] }> {
  return await apiPostWithHeaders("/api/board/collect", { entity_id: entityId }, playerHeaders());
}

export async function boardAssignTask(taskId: number, villagerId: string) {
  return await apiPostWithHeaders("/api/board/assign-task", { task_id: taskId, villager_id: villagerId }, playerHeaders());
}

export async function boardCompleteTask(taskId: number) {
  return await apiPostWithHeaders("/api/board/complete-task", { task_id: taskId }, playerHeaders());
}


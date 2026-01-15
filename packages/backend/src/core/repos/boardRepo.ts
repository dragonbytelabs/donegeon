import type { BoardStateDto } from "@donegeon/app/api";

export type PlayerId = string;

function emptyBoard(): BoardStateDto {
  return { grid_size: 100, entities: [], stacks: [] };
}

export class BoardRepo {
  private byPlayer = new Map<PlayerId, BoardStateDto>();

  get(playerId: PlayerId): BoardStateDto {
    const existing = this.byPlayer.get(playerId);
    if (existing) return existing;
    const created = emptyBoard();
    this.byPlayer.set(playerId, created);
    return created;
  }

  set(playerId: PlayerId, state: BoardStateDto) {
    this.byPlayer.set(playerId, state);
  }
}


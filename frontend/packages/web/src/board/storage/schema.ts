export const DB_NAME = "donegeon-board";
export const DB_VERSION = 1;

export interface SerializedCard {
  id: string;
  defId: string;
  data: Record<string, unknown>;
}

export interface SerializedStack {
  id: string;
  pos: { x: number; y: number };
  z: number;
  cards: SerializedCard[];
}

export interface BoardSnapshot {
  id: string; // "default" for single board
  version: number; // schema version
  timestamp: number;
  stacks: SerializedStack[];
  maxZ: number;
}

export interface DonegeonDB {
  boards: {
    key: string;
    value: BoardSnapshot;
    indexes: { "by-timestamp": number };
  };
}

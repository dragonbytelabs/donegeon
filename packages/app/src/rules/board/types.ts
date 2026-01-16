export type Vec2 = { x: number; y: number };

export type EntityKind = "deck" | "card";

export type StackId = string;

export type BoardEntityBase = {
  id: string;
  kind: EntityKind;
  pos: Vec2; // world coords
  stack_id?: StackId;
};

export type DeckEntity = BoardEntityBase & {
  kind: "deck";
  deck_id: string; // e.g. deck_first_day
};

export type CardEntity = BoardEntityBase & {
  kind: "card";
  card_type: "task" | "villager" | "modifier" | "loot" | "resource" | "food";
  // subtype used for stack compatibility (e.g. mushroom vs berry).
  subtype?: string;
  payload?: unknown;
};

export type BoardEntity = DeckEntity | CardEntity;

export type BoardState = {
  gridSize: number;
  entities: Record<string, BoardEntity>;
  stacks: Record<
    StackId,
    {
      id: StackId;
      // task is always front-facing if present
      task_id?: string;
      // ordered from front to back (excluding task_id which is implicit front)
      attached_ids: string[];
    }
  >;
};

export type MoveEntityIntent = {
  kind: "move_entity";
  entity_id: string;
  to: Vec2;
};

export type StackIntent = {
  kind: "stack";
  source_id: string;
  target_id: string;
};

export type UnstackIntent = {
  kind: "unstack";
  stack_id: StackId;
};

// Events emitted by board rules (backend can forward as BoardEventDto for animations/UX).
export type BoardRuleEvent = { kind: "wiggle"; entity_id: string; to: Vec2 };

export type ApplyResult =
  | { ok: true; next: BoardState; events?: BoardRuleEvent[] }
  | { ok: false; reason: "not_found" | "occupied" | "out_of_bounds" };


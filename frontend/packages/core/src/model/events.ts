import type { Point, StackId } from "./types";

export type EngineEvent =
  | { type: "stack.created"; stackId: StackId; pos: Point }
  | { type: "stack.removed"; stackId: StackId }
  | { type: "stack.merged"; targetId: StackId; sourceId: StackId }
  | { type: "stack.split"; sourceId: StackId; newId: StackId; index: number }
  | { type: "stack.unstacked"; sourceId: StackId; createdIds: StackId[] }
  | { type: "stack.pop"; sourceId: StackId };




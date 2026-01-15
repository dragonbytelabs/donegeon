import type {
  ApplyResult,
  BoardState,
  MoveEntityIntent,
  StackId,
  StackIntent,
  UnstackIntent,
  Vec2
} from "./types.js";
import { canStackCards, inBounds, isCard, isOccupied } from "./legality.js";
import { snapToGrid } from "./snap.js";

export function applyMove(state: BoardState, intent: MoveEntityIntent): ApplyResult {
  const e = state.entities[intent.entity_id];
  if (!e) return { ok: false, reason: "not_found" };

  const snapped = snapToGrid(intent.to, state.gridSize);
  if (!inBounds(snapped)) return { ok: false, reason: "out_of_bounds" };
  if (isOccupied(state, snapped, intent.entity_id)) return { ok: false, reason: "occupied" };

  return {
    ok: true,
    next: {
      ...state,
      entities: {
        ...state.entities,
        [intent.entity_id]: { ...e, pos: snapped }
      }
    }
  };
}

export function applyStack(state: BoardState, intent: StackIntent): ApplyResult {
  const a = state.entities[intent.source_id];
  const b = state.entities[intent.target_id];
  if (!a || !b) return { ok: false, reason: "not_found" };
  if (!isCard(a) || !isCard(b)) return { ok: false, reason: "occupied" };
  if (!canStackCards(a, b)) return { ok: false, reason: "occupied" };

  // If target already in a stack, use it; otherwise create a new stack.
  const stackId: StackId = b.stack_id ?? `stack_${b.id}`;
  const existing = state.stacks[stackId] ?? { id: stackId, task_id: undefined, attached_ids: [] as string[] };

  // Ensure task is always front if either card is a task.
  let task_id = existing.task_id;
  const attached = [...existing.attached_ids];

  function attach(cardId: string) {
    if (cardId === task_id) return;
    if (!attached.includes(cardId)) attached.push(cardId);
  }

  if (a.card_type === "task") task_id = a.id;
  if (b.card_type === "task") task_id = b.id;

  // Attach both non-task cards behind in order of operation (source appended last).
  if (b.card_type !== "task") attach(b.id);
  if (a.card_type !== "task") attach(a.id);

  const nextStacks = { ...state.stacks, [stackId]: { id: stackId, task_id, attached_ids: attached } };

  // Snap both to the same origin (target position).
  const origin = { ...b.pos };
  const nextEntities: any = { ...state.entities };
  nextEntities[b.id] = { ...b, pos: origin, stack_id: stackId };
  nextEntities[a.id] = { ...a, pos: origin, stack_id: stackId };
  if (task_id) nextEntities[task_id] = { ...state.entities[task_id], pos: origin, stack_id: stackId };
  for (const cid of attached) nextEntities[cid] = { ...state.entities[cid], pos: origin, stack_id: stackId };

  return { ok: true, next: { ...state, stacks: nextStacks, entities: nextEntities } };
}

function findOpenPositions(state: BoardState, start: Vec2, count: number): Vec2[] {
  const out: Vec2[] = [];
  const step = state.gridSize;
  // Prefer horizontal line to the right.
  for (let i = 0; i < 1000 && out.length < count; i++) {
    const p = snapToGrid({ x: start.x + step * (i + 1), y: start.y }, step);
    if (!inBounds(p)) continue;
    if (!isOccupied(state, p)) out.push(p);
  }
  // If not enough, try rows below.
  for (let row = 1; row < 30 && out.length < count; row++) {
    for (let col = 0; col < 30 && out.length < count; col++) {
      const p = snapToGrid({ x: start.x + step * col, y: start.y + step * row }, step);
      if (!inBounds(p)) continue;
      if (!isOccupied(state, p)) out.push(p);
    }
  }
  return out;
}

export function applyUnstack(state: BoardState, intent: UnstackIntent): ApplyResult {
  const st = state.stacks[intent.stack_id];
  if (!st) return { ok: false, reason: "not_found" };

  const ids: string[] = [];
  if (st.task_id) ids.push(st.task_id);
  ids.push(...st.attached_ids);
  if (ids.length === 0) return { ok: true, next: state };

  const origin = state.entities[ids[0]]?.pos ?? { x: 0, y: 0 };
  const targets = findOpenPositions(state, origin, ids.length);
  if (targets.length < ids.length) return { ok: false, reason: "out_of_bounds" };

  const nextEntities: any = { ...state.entities };
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!;
    nextEntities[id] = { ...nextEntities[id], pos: targets[i]!, stack_id: undefined };
  }

  const nextStacks = { ...state.stacks };
  delete nextStacks[intent.stack_id];

  return { ok: true, next: { ...state, entities: nextEntities, stacks: nextStacks } };
}

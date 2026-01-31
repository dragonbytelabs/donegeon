import { createSignal, type Signal } from "../core/reactivity";
import { uid } from "../core/ids";
import { assert, assertFiniteNumber, assertInt } from "../core/assert";
import type { Point, StackId } from "./types";
import { StackEntity } from "./stack";
import type { CardEntity } from "./card";
import { Emitter } from "../core/emitter";
import type { EngineEvent } from "./events";

export class Engine {
  stacks = new Map<StackId, StackEntity>();
  stackIds: Signal<StackId[]> = createSignal<StackId[]>([]);

  events = new Emitter<EngineEvent>();

  private z = 10;

  getMaxZ(): number {
    return this.z;
  }

  setMaxZ(val: number): void {
    this.z = Math.max(this.z, val);
  }

  nextZ() {
    this.z++;
    return this.z;
  }

  /** Dev/test helper: validate engine bookkeeping invariants. */
  assertValid() {
    const ids = this.stackIds[0]();
    assert(ids.length === this.stacks.size, "Engine.assertValid: stackIds.size !== stacks.size");

    const seen = new Set<StackId>();
    for (const id of ids) {
      assert(!seen.has(id), `Engine.assertValid: duplicate id in stackIds: ${id}`);
      seen.add(id);
      assert(this.stacks.has(id), `Engine.assertValid: stackIds contains missing stack: ${id}`);
    }
  }

  getStack(id: StackId): StackEntity | undefined {
    return this.stacks.get(id);
  }

  addStack(s: StackEntity) {
    assert(s && typeof s.id === "string", "Engine.addStack: stack must have an id");
    assert(!this.stacks.has(s.id), `Engine.addStack: duplicate stack id: ${s.id}`);

    this.stacks.set(s.id, s);
    this.stackIds[1]((prev) => [...prev, s.id]);

    // postcondition: ids reflect map
    this.assertValid();

    this.events.emit({ type: "stack.created", stackId: s.id, pos: s.pos[0]() });
  }

  removeStack(id: StackId) {
    // soft failure: UI can race-remove
    if (!this.stacks.has(id)) return;

    this.stacks.delete(id);
    this.stackIds[1]((prev) => prev.filter((x) => x !== id));

    // postcondition: ids reflect map
    this.assertValid();

    this.events.emit({ type: "stack.removed", stackId: id });
  }

  createStack(pos: Point, cards: CardEntity[] = []) {
    assertFiniteNumber(pos?.x, "Engine.createStack(pos.x)");
    assertFiniteNumber(pos?.y, "Engine.createStack(pos.y)");
    assert(Array.isArray(cards), "Engine.createStack(cards) must be an array");

    const s = new StackEntity(uid("stack"), pos, cards);
    s.z[1](this.nextZ());
    this.addStack(s);
    return s;
  }

  bringToFront(stackId: StackId) {
    // soft failure: stack might have been removed
    const s = this.stacks.get(stackId);
    if (!s) return;
    s.z[1](this.nextZ());
  }

  /**
   * Split a stack into two stacks at index:
   * existing keeps [0..index-1], new gets [index..end]
   *
   * Boundary:
   * - missing stack => null (soft)
   * - index out of range => null (soft)
   * - non-integer index => assert (hard)
   */
  splitStack(stackId: StackId, index: number, offset: Point = { x: 12, y: 12 }) {
    assertInt(index, "Engine.splitStack(index)");
    assertFiniteNumber(offset?.x, "Engine.splitStack(offset.x)");
    assertFiniteNumber(offset?.y, "Engine.splitStack(offset.y)");

    const s = this.stacks.get(stackId);
    if (!s) return null;

    const before = s.cards[0]().length;

    const pulled = s.splitFrom(index);
    if (!pulled) return null;

    // postcondition: source stack shrank by pulled length
    const after = s.cards[0]().length;
    assert(after + pulled.length === before, "Engine.splitStack: source size mismatch after split");

    const p = s.pos[0]();
    const ns = this.createStack({ x: p.x + offset.x, y: p.y + offset.y }, pulled);

    // postcondition: new stack created with pulled cards
    assert(ns.cards[0]().length === pulled.length, "Engine.splitStack: new stack size mismatch");

    this.events.emit({ type: "stack.split", sourceId: stackId, newId: ns.id, index });
    return ns;
  }

  /**
   * Merge source stack into target stack, then remove source.
   *
   * Boundary:
   * - missing stacks => no-op (soft)
   * - same id => no-op (soft)
   */
  mergeStacks(targetId: StackId, sourceId: StackId) {
    if (targetId === sourceId) return;

    const target = this.stacks.get(targetId);
    const source = this.stacks.get(sourceId);
    if (!target || !source) return;

    const beforeTarget = target.cards[0]().length;
    const beforeSource = source.cards[0]().length;

    target.mergeFrom(source);

    // postcondition: target grew by source size (unless source empty)
    const afterTarget = target.cards[0]().length;
    assert(
      afterTarget === beforeTarget + beforeSource,
      "Engine.mergeStacks: target size mismatch after merge"
    );

    this.removeStack(sourceId);
    this.bringToFront(targetId);

    // postcondition: source removed
    assert(!this.stacks.has(sourceId), "Engine.mergeStacks: source still exists after remove");

    this.events.emit({ type: "stack.merged", targetId, sourceId });
  }

  /**
   * Unstack: remove stack, create N single-card stacks around it.
   *
   * Boundary:
   * - missing stack => [] (soft)
   * - stack size <= 1 => [] (soft) (nothing to unstack)
   */
  unstack(stackId: StackId, positions: Point[]) {
    assert(Array.isArray(positions), "Engine.unstack(positions) must be an array");

    const s = this.stacks.get(stackId);
    if (!s) return [];

    const before = s.cards[0]().length;
    const bundles = s.unstackIntoSingles();
    if (bundles.length <= 1) return [];

    // invariant: bundles length equals card count
    assert(bundles.length === before, "Engine.unstack: bundle count must equal stack size");

    this.removeStack(stackId);

    const created: StackEntity[] = [];
    for (let i = 0; i < bundles.length; i++) {
      const pos = positions[i] ?? s.pos[0]();
      created.push(this.createStack(pos, bundles[i]));
    }

    // postcondition: created N stacks
    assert(created.length === before, "Engine.unstack: created stack count mismatch");

    this.events.emit({
      type: "stack.unstacked",
      sourceId: stackId,
      createdIds: created.map((x) => x.id),
    });

    return created;
  }

  /**
   * Pop the bottom card off a stack and create a new 1-card stack nearby.
   *
   * Boundary:
   * - missing stack => null (soft)
   * - empty stack => null (soft)
   */
  popBottom(stackId: StackId, offset: Point = { x: 0, y: 0 }) {
    assertFiniteNumber(offset?.x, "Engine.popBottom(offset.x)");
    assertFiniteNumber(offset?.y, "Engine.popBottom(offset.y)");

    const s = this.stacks.get(stackId);
    if (!s) return null;

    const before = s.cards[0]().length;

    const card = s.takeBottom();
    if (!card) return null;

    // postcondition: stack shrank by 1
    const after = s.cards[0]().length;
    assert(after + 1 === before, "Engine.popBottom: source size mismatch after takeBottom");

    const origin = s.pos[0]();
    const ns = this.createStack({ x: origin.x + offset.x, y: origin.y + offset.y }, [card]);

    // postcondition: new stack has exactly 1 card
    assert(ns.cards[0]().length === 1, "Engine.popBottom: new stack must have exactly 1 card");

    if (after === 0) {
      this.removeStack(stackId);
    }

    this.events.emit({ type: "stack.pop", sourceId: stackId });
    return ns;
  }
}



import { createSignal, type Signal } from "../core/reactivity";
import { uid } from "../core/ids";
import type { Point, StackId } from "./types";
import { StackEntity } from "./stack";
import type { CardEntity } from "./card";
import { Emitter } from "../core/emitter";
import type { EngineEvent } from "./event";


export class Engine {
  stacks = new Map<StackId, StackEntity>();
  stackIds: Signal<StackId[]> = createSignal<StackId[]>([]);

  events = new Emitter<EngineEvent>();

  private z = 10;
  nextZ() {
    this.z++;
    return this.z;
  }

  getStack(id: StackId): StackEntity | undefined {
    return this.stacks.get(id);
  }

  addStack(s: StackEntity) {
    this.stacks.set(s.id, s);
    this.stackIds[1]((prev) => [...prev, s.id]);
    this.events.emit({ type: "stack.created", stackId: s.id, pos: s.pos[0]() });
  }

  removeStack(id: StackId) {
    if (!this.stacks.has(id)) return;
    this.stacks.delete(id);
    this.stackIds[1]((prev) => prev.filter((x) => x !== id));
    this.events.emit({ type: "stack.removed", stackId: id });
  }

  createStack(pos: Point, cards: CardEntity[] = []) {
    const s = new StackEntity(uid("stack"), pos, cards);
    s.z[1](this.nextZ());
    this.addStack(s);
    return s;
  }

  bringToFront(stackId: StackId) {
    const s = this.stacks.get(stackId);
    if (!s) return;
    s.z[1](this.nextZ());
  }

  /**
   * Split a stack into two stacks at index:
   * existing keeps [0..index-1], new gets [index..end]
   */
  splitStack(
    stackId: StackId,
    index: number,
    offset: Point = { x: 12, y: 12 },
  ) {
    const s = this.stacks.get(stackId);
    if (!s) return null;

    const pulled = s.splitFrom(index);
    if (!pulled) return null;

    const p = s.pos[0]();
    const ns = this.createStack(
      { x: p.x + offset.x, y: p.y + offset.y },
      pulled,
    );
    this.events.emit({ type: "stack.split", sourceId: stackId, newId: ns.id, index });
    return ns;
  }

  /**
   * Merge source stack into target stack, then remove source.
   */
  mergeStacks(targetId: StackId, sourceId: StackId) {
    if (targetId === sourceId) return;

    const target = this.stacks.get(targetId);
    const source = this.stacks.get(sourceId);
    if (!target || !source) return;

    target.mergeFrom(source);
    this.removeStack(sourceId);
    this.bringToFront(targetId);
    this.events.emit({ type: "stack.merged", targetId, sourceId });
  }

  /**
   * Unstack: remove stack, create N single-card stacks around it.
   * (positions are decided by caller or a helper you add later)
   */
  unstack(stackId: StackId, positions: Point[]) {
    const s = this.stacks.get(stackId);
    if (!s) return [];

    const bundles = s.unstackIntoSingles();
    if (bundles.length <= 1) return [];

    this.removeStack(stackId);

    const created: StackEntity[] = [];
    for (let i = 0; i < bundles.length; i++) {
      const pos = positions[i] ?? s.pos[0]();
      created.push(this.createStack(pos, bundles[i]));
    }
    this.events.emit({
      type: "stack.unstacked",
      sourceId: stackId,
      createdIds: created.map((x) => x.id),
    });
    return created;
  }

  /**
   * Pop the bottom card off a stack and create a new 1-card stack nearby.
   * If the original stack becomes empty, remove it.
   */
  popBottom(stackId: StackId, offset: Point = { x: 0, y: 0 }) {
    const s = this.stacks.get(stackId);
    if (!s) return null;

    const card = s.takeBottom();
    if (!card) return null;

    const origin = s.pos[0]();
    const ns = this.createStack({ x: origin.x + offset.x, y: origin.y + offset.y }, [card]);

    if (s.cards[0]().length === 0) {
      this.removeStack(stackId);
    }

    this.events.emit({
      type: "stack.pop",
      sourceId: stackId,
    });

    return ns;
  }
}

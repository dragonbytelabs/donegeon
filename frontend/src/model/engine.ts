import { createSignal, type Signal } from "../core/reactivity";
import { uid } from "../core/ids";
import type { Point, StackId } from "./types";
import { StackEntity } from "./stack";
import type { CardEntity } from "./card";

export class Engine {
  stacks = new Map<StackId, StackEntity>();

  // reactive list for mounting/unmounting stack views
  stackIds: Signal<StackId[]> = createSignal<StackId[]>([]);

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
  }

  removeStack(id: StackId) {
    if (!this.stacks.has(id)) return;
    this.stacks.delete(id);
    this.stackIds[1]((prev) => prev.filter((x) => x !== id));
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

    return ns;
  }
}

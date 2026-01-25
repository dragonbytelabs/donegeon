import { produce } from "immer";
import { Entity } from "./entity";
import { createSignal, type Signal } from "../core/reactivity";
import { assert, assertInt } from "../core/assert";
import type { Point, StackId } from "./types";
import type { CardEntity } from "./card";

export class StackEntity extends Entity {
  pos: Signal<Point>;
  cards: Signal<CardEntity[]>;
  z: Signal<number>;

  constructor(id: StackId, initialPos: Point, initialCards: CardEntity[] = []) {
    super(id);
    this.pos = createSignal<Point>(initialPos);
    this.cards = createSignal<CardEntity[]>(initialCards);
    this.z = createSignal<number>(1);
  }

  // ---------- Access helpers ----------
  get size() {
    return this.cards[0]().length;
  }

  topIndex() {
    return this.size - 1;
  }

  topCard(): CardEntity | undefined {
    const cs = this.cards[0]();
    return cs[cs.length - 1];
  }

  bottomCard(): CardEntity | undefined {
    const cs = this.cards[0]();
    return cs[0];
  }

  // ---------- Mutations (Immer-backed) ----------
  setCards(next: CardEntity[]) {
    assert(Array.isArray(next), "StackEntity.setCards: next must be an array");
    this.cards[1](next);
  }

  /** Remove and return top card. Soft-fails on empty. */
  takeTop(): CardEntity | null {
    const before = this.cards[0]();
    if (before.length === 0) return null;

    let taken: CardEntity | null = null;
    this.cards[1](
      produce(before, (draft) => {
        taken = draft.pop() ?? null;
      })
    );

    // postcondition: length decreased by 1 and taken exists
    const after = this.cards[0]().length;
    assert(taken !== null, "StackEntity.takeTop: taken must not be null after pop");
    assert(after + 1 === before.length, "StackEntity.takeTop: size mismatch after pop");

    return taken;
  }

  /** Remove and return bottom card. Soft-fails on empty. */
  takeBottom(): CardEntity | null {
    const before = this.cards[0]();
    if (before.length === 0) return null;

    let taken: CardEntity | null = null;
    this.cards[1](
      produce(before, (draft) => {
        taken = draft.shift() ?? null;
      })
    );

    // postcondition: length decreased by 1 and taken exists
    const after = this.cards[0]().length;
    assert(taken !== null, "StackEntity.takeBottom: taken must not be null after shift");
    assert(after + 1 === before.length, "StackEntity.takeBottom: size mismatch after shift");

    return taken;
  }

  /**
   * Remove and return a range [start..end) (bottom-inclusive range in the array).
   * Soft-fails if out of bounds or invalid range.
   *
   * Hard asserts:
   * - indices must be integers
   */
  takeRange(start: number, endExclusive: number): CardEntity[] | null {
    assertInt(start, "StackEntity.takeRange(start)");
    assertInt(endExclusive, "StackEntity.takeRange(endExclusive)");

    const before = this.cards[0]();
    if (start < 0 || endExclusive > before.length || start >= endExclusive) return null;

    let out: CardEntity[] = [];
    this.cards[1](
      produce(before, (draft) => {
        out = draft.splice(start, endExclusive - start);
      })
    );

    // postcondition: removed exactly out.length cards
    const after = this.cards[0]().length;
    assert(after + out.length === before.length, "StackEntity.takeRange: size mismatch after splice");

    return out;
  }

  /**
   * Split stack in place at `index`:
   * [1,2,3,4,5], index=2 => this becomes [1,2], returns [3,4,5]
   *
   * Soft-fails for index out of range.
   * Hard asserts: index must be integer.
   */
  splitFrom(index: number): CardEntity[] | null {
    assertInt(index, "StackEntity.splitFrom(index)");

    const before = this.cards[0]();
    if (index <= 0 || index >= before.length) return null;

    let pulled: CardEntity[] = [];
    this.cards[1](
      produce(before, (draft) => {
        pulled = draft.splice(index);
      })
    );

    // postcondition: pulled length is before.length - index
    const after = this.cards[0]().length;
    assert(pulled.length === before.length - index, "StackEntity.splitFrom: pulled length mismatch");
    assert(after === index, "StackEntity.splitFrom: remaining size mismatch");

    return pulled;
  }

  /** Merge another stack's cards on top of this stack. No-op if other is empty. */
  mergeFrom(other: StackEntity) {
    const a = this.cards[0]();
    const b = other.cards[0]();
    if (b.length === 0) return;

    const beforeA = a.length;

    this.cards[1](
      produce(a, (draft) => {
        draft.push(...b);
      })
    );

    // postcondition: grew by b.length
    const afterA = this.cards[0]().length;
    assert(afterA === beforeA + b.length, "StackEntity.mergeFrom: size mismatch after push");
  }

  /** True if more than 1 card. */
  isStacked() {
    return this.size > 1;
  }

  /**
   * Used by "unstack" -> create N single-card stacks.
   * Returns arrays of 1 card each (does not create stacks; engine does that).
   */
  unstackIntoSingles(): CardEntity[][] {
    const cs = this.cards[0]();
    if (cs.length <= 1) return [cs.slice()];
    return cs.map((c) => [c]);
  }
}



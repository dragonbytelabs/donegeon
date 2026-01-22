import { produce } from "immer";
import { Entity } from "./entity";
import { createSignal, type Signal } from "../core/reactivity";
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
    this.cards[1](next);
  }

  /** Remove and return top card. */
  takeTop(): CardEntity | null {
    const before = this.cards[0]();
    if (before.length === 0) return null;

    let taken: CardEntity | null = null;
    this.cards[1](
      produce(before, (draft) => {
        taken = draft.pop() ?? null;
      }),
    );
    return taken;
  }

  /** Remove and return bottom card. */
  takeBottom(): CardEntity | null {
    const before = this.cards[0]();
    if (before.length === 0) return null;

    let taken: CardEntity | null = null;
    this.cards[1](
      produce(before, (draft) => {
        taken = draft.shift() ?? null;
      }),
    );
    return taken;
  }

  /**
   * Remove and return a range [start..end) (bottom-inclusive range in the array).
   * Example: cards [1,2,3,4,5], takeRange(2,5) => returns [3,4,5], stack becomes [1,2]
   */
  takeRange(start: number, endExclusive: number): CardEntity[] | null {
    const before = this.cards[0]();
    if (start < 0 || endExclusive > before.length || start >= endExclusive)
      return null;

    let out: CardEntity[] = [];
    this.cards[1](
      produce(before, (draft) => {
        out = draft.splice(start, endExclusive - start);
      }),
    );
    return out;
  }

  /**
   * Split stack in place at `index`:
   * [1,2,3,4,5], index=2 => this becomes [1,2], returns [3,4,5]
   *
   * This is your "shift-drag 3" behavior.
   */
  splitFrom(index: number): CardEntity[] | null {
    const before = this.cards[0]();
    if (index <= 0 || index >= before.length) return null;

    let pulled: CardEntity[] = [];
    this.cards[1](
      produce(before, (draft) => {
        pulled = draft.splice(index);
      }),
    );

    return pulled;
  }

  /** Merge another stack's cards on top of this stack. */
  mergeFrom(other: StackEntity) {
    const a = this.cards[0]();
    const b = other.cards[0]();
    if (b.length === 0) return;

    this.cards[1](
      produce(a, (draft) => {
        draft.push(...b);
      }),
    );
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

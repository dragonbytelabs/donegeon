# LLM Context Pack — @cleartify/core (Source of Truth)

This `llm.md` is a single-file mirror of `packages/core/src`.
Edit sections carefully and keep paths + triple-backtick fences intact so the source tree can be reconstructed.

<!-- LLM_HEADER_END -->

# core/assert.ts

```ts
import { getRuntime } from "./runtime";

/**
 * Hard invariant assertion.
 * Use for "this should never happen" and for guarding internal assumptions.
 */
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    getRuntime().logError("ASSERT:", message);
    throw new Error(`ASSERT: ${message}`);
  }
}

/** Ensure a value is a finite number (not NaN/Infinity). */
export function assertFiniteNumber(n: unknown, name: string): asserts n is number {
  assert(typeof n === "number" && Number.isFinite(n), `${name} must be a finite number`);
}

/** Ensure a value is an integer. */
export function assertInt(n: unknown, name: string): asserts n is number {
  assert(typeof n === "number" && Number.isInteger(n), `${name} must be an integer`);
}

export function assertNever(x: never, message = "unexpected value"): never {
  throw new Error(`ASSERT: ${message}: ${String(x)}`);
}


```

# core/emitter.ts

```ts
import { getRuntime } from "./runtime";

export type Unsubscribe = () => void;

export class Emitter<T> {
  private subs = new Set<(event: T) => void>();

  on(fn: (event: T) => void): Unsubscribe {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  once(fn: (event: T) => void): Unsubscribe {
    const off = this.on((e) => {
      off();
      fn(e);
    });
    return off;
  }

  emit(event: T) {
    const errors: unknown[] = [];
    for (const fn of Array.from(this.subs)) {
      try {
        fn(event);
      } catch (err) {
        errors.push(err);
      }
    }
    if (errors.length) {
      // log + throw to avoid “silent corruption”
      getRuntime().logError("Emitter handler error(s):", errors);
      throw new AggregateError(errors, "Emitter emit() handler error(s)");
    }
  }

  clear() {
    this.subs.clear();
  }

  get size() {
    return this.subs.size;
  }
}


```

# core/geom.ts

```ts
import type { Point, Pan } from "../model/types";

export const GRID = 22;
export const DOT_PHASE = 1;

export function snapToGrid(x: number, y: number) {
  const sx = Math.round((x - DOT_PHASE) / GRID) * GRID + DOT_PHASE;
  const sy = Math.round((y - DOT_PHASE) / GRID) * GRID + DOT_PHASE;
  return { x: sx, y: sy };
}

/**
 * DOM-free conversion helper.
 * Pass in the board root's client rect explicitly (from the web adapter).
 */
export function clientToBoardFromRect(
  clientX: number,
  clientY: number,
  rootRect: { left: number; top: number },
  pan: Pan
): Point {
  const localX = clientX - rootRect.left;
  const localY = clientY - rootRect.top;
  return { x: localX - pan.x, y: localY - pan.y };
}


```

# core/ids.ts

```ts
import { getRuntime } from "./runtime";

export type EntityId = string;

export function uid(prefix: string): EntityId {
  const { randomUUID } = getRuntime();
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}


```

# core/reactivity.ts

```ts
import { getRuntime } from "./runtime";

export type Accessor<T> = () => T;
export type Setter<T> = (value: T | ((prev: T) => T)) => T;
export type Signal<T> = [Accessor<T>, Setter<T>];

export type CleanupFn = () => void;
export type Disposer = () => void;

type Computation = {
  fn: () => void;
  deps: Set<SignalImpl<any>>;
  cleanups: CleanupFn[];
  scheduled: boolean;
  disposed: boolean;
};

type SignalImpl<T> = {
  value: T;
  observers: Set<Computation>;
  equals?: (a: T, b: T) => boolean;
};

let Current: Computation | null = null;

// --- scheduler (microtask-batched) ---
const queue = new Set<Computation>();
let flushing = false;

function schedule(c: Computation) {
  if (c.disposed || c.scheduled) return;
  c.scheduled = true;
  queue.add(c);
  if (!flushing) {
    flushing = true;
    getRuntime().queueMicrotask(flush);
  }
}

function flush() {
  try {
    for (const c of Array.from(queue)) {
      queue.delete(c);
      c.scheduled = false;
      if (c.disposed) continue;
      run(c);
    }
  } finally {
    flushing = false;
  }
}

let batchDepth = 0;
function flushIfNeeded() {
  if (batchDepth === 0 && queue.size > 0 && !flushing) {
    flushing = true;
    getRuntime().queueMicrotask(flush);
  }
}

export function batch(fn: () => void) {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    flushIfNeeded();
  }
}

// --- core execution + cleanup ---
function cleanupComputation(c: Computation) {
  for (const dep of c.deps) dep.observers.delete(c);
  c.deps.clear();

  for (const cl of c.cleanups) {
    try {
      cl();
    } catch (err) {
      getRuntime().logError("cleanup error:", err);
    }
  }
  c.cleanups.length = 0;
}

function run(c: Computation) {
  cleanupComputation(c);
  const prev = Current;
  Current = c;
  try {
    c.fn();
  } finally {
    Current = prev;
  }
}

function createComputation(fn: () => void): Computation {
  return { fn, deps: new Set(), cleanups: [], scheduled: false, disposed: false };
}

// --- public API ---
export function createSignal<T>(
  initial: T,
  opts?: { equals?: (a: T, b: T) => boolean }
): Signal<T> {
  const s: SignalImpl<T> = { value: initial, observers: new Set(), equals: opts?.equals };

  const read: Accessor<T> = () => {
    if (Current && !Current.disposed) {
      s.observers.add(Current);
      Current.deps.add(s);
    }
    return s.value;
  };

  const write: Setter<T> = (next) => {
    const v = typeof next === "function" ? (next as (p: T) => T)(s.value) : next;
    const same = s.equals ? s.equals(s.value, v) : Object.is(s.value, v);
    if (same) return s.value;

    s.value = v;
    for (const obs of s.observers) schedule(obs);
    if (batchDepth === 0) flushIfNeeded();
    return s.value;
  };

  return [read, write];
}

function disposeComputation(c: Computation) {
  if (c.disposed) return;
  c.disposed = true;
  queue.delete(c);
  cleanupComputation(c);
}

export function createEffect(fn: () => void): Disposer {
  const c = createComputation(fn);
  run(c);

  const dispose: Disposer = () => disposeComputation(c);

  // If we're inside a root, tie this effect to that root.
  const rootAtCreation = CurrentRoot;
  if (rootAtCreation) rootAtCreation.disposers.add(dispose);

  return () => {
    if (rootAtCreation) rootAtCreation.disposers.delete(dispose);
    dispose();
  };
}

export function createMemo<T>(
  fn: () => T,
  initial?: T,
  opts?: { equals?: (a: T, b: T) => boolean }
): Accessor<T> {
  const [get, set] = createSignal<T>(initial as T, opts);
  createEffect(() => set(fn()));
  return get;
}

export function onCleanup(fn: CleanupFn) {
  if (!Current || Current.disposed) {
    throw new Error("onCleanup must be called inside createEffect/createRoot scope");
  }
  Current.cleanups.push(fn);
}

export function untrack<T>(fn: () => T): T {
  const prev = Current;
  Current = null;
  try {
    return fn();
  } finally {
    Current = prev;
  }
}

// --- Optional: root scope for disposal ---
type RootScope = {
  parent: RootScope | null;
  disposers: Set<Disposer>;
};

let CurrentRoot: RootScope | null = null;

export function createRoot<T>(fn: (dispose: Disposer) => T): T {
  const parent = CurrentRoot;
  const root: RootScope = { parent, disposers: new Set() };
  CurrentRoot = root;

  const dispose: Disposer = () => {
    for (const d of Array.from(root.disposers)) {
      try {
        d();
      } catch (err) {
        getRuntime().logError("dispose error:", err);
      }
    }
    root.disposers.clear();
  };

  try {
    return fn(dispose);
  } finally {
    CurrentRoot = parent;
  }
}


```

# core/runtime.ts

```ts
export type Runtime = {
  /** Crypto-grade UUID if available, else best-effort fallback. */
  randomUUID: () => string;

  /** Microtask scheduling (or a Promise fallback). */
  queueMicrotask: (fn: () => void) => void;

  /** Logging hook (can be replaced in production). */
  logError: (...args: unknown[]) => void;
};

function fallbackUUID(): string {
  // Best-effort fallback. For safety-critical identity, inject your own runtime.randomUUID.
  const t = Date.now().toString(16);
  const r = Math.floor(Math.random() * 1e16).toString(16);
  return `${t}-${r}`.slice(0, 36);
}

const defaultRuntime: Runtime = {
  randomUUID: () => {
    const c = (globalThis as any).crypto;
    if (c?.randomUUID) return c.randomUUID();
    return fallbackUUID();
  },
  queueMicrotask: (fn) => {
    const qm = (globalThis as any).queueMicrotask as undefined | ((f: () => void) => void);
    if (qm) return qm(fn);
    Promise.resolve().then(fn);
  },
  logError: (...args) => {
    // eslint-disable-next-line no-console
    (globalThis as any).console?.error?.(...args);
  },
};

let runtime: Runtime = defaultRuntime;

export function getRuntime(): Runtime {
  return runtime;
}

/**
 * Inject a runtime from the host platform (web, node, react-native, etc).
 * This is how core stays DOM-free.
 */
export function setRuntime(next: Partial<Runtime>) {
  runtime = { ...runtime, ...next };
}


```

# index.ts

```ts
export * from "./core/runtime";
export * from "./core/assert";
export * from "./core/reactivity";
export * from "./core/ids";
export * from "./core/emitter";
export * from "./core/geom";

export * from "./model/types";
export * from "./model/entity";
export * from "./model/card";
export * from "./model/stack";
export * from "./model/engine";
export * from "./model/deck";
export * from "./model/events";


```

# model/card.ts

```ts
import { Entity } from "./entity";
import type { CardData, CardDef, CardId } from "./types";

export class CardEntity extends Entity {
  constructor(
    id: CardId,
    public readonly def: CardDef,
    public data: CardData = {}
  ) {
    super(id);
  }

  // convenience helpers
  get title() {
    return this.def.title;
  }
  get icon() {
    return this.def.icon;
  }
  get kind() {
    return this.def.kind;
  }
  get skinClass() {
    return this.def.skin;
  }
}


```

# model/deck.ts

```ts
import { uid } from "../core/ids";
import { assert } from "../core/assert";
import { CardEntity } from "./card";
import type { CardDef, CardDefId } from "./types";

export class Deck {
  private defs = new Map<CardDefId, CardDef>();

  constructor(initial: CardDef[] = []) {
    for (const d of initial) this.defs.set(d.id, d);
  }

  addDef(def: CardDef) {
    this.defs.set(def.id, def);
  }

  getDef(id: CardDefId) {
    const d = this.defs.get(id);
    assert(d, `Deck.getDef: unknown CardDef: ${id}`);
    return d;
  }

  allDefs(): CardDef[] {
    return Array.from(this.defs.values());
  }

  spawn(defId: CardDefId, data: Record<string, unknown> = {}) {
    const def = this.getDef(defId);
    return new CardEntity(uid("card"), def, data);
  }
}


```

# model/engine.ts

```ts
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


```

# model/entity.ts

```ts
import type { EntityId } from "../core/ids";

export abstract class Entity {
  constructor(public readonly id: EntityId) {}
}


```

# model/events.ts

```ts
import type { Point, StackId } from "./types";

export type EngineEvent =
  | { type: "stack.created"; stackId: StackId; pos: Point }
  | { type: "stack.removed"; stackId: StackId }
  | { type: "stack.merged"; targetId: StackId; sourceId: StackId }
  | { type: "stack.split"; sourceId: StackId; newId: StackId; index: number }
  | { type: "stack.unstacked"; sourceId: StackId; createdIds: StackId[] }
  | { type: "stack.pop"; sourceId: StackId };


```

# model/stack.ts

```ts
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


```

# model/types.ts

```ts
import type { EntityId } from "../core/ids";

export type Point = { x: number; y: number };
export type Pan = { x: number; y: number };

export type CardKind =
  | "event"
  | "agent"
  | "rule"
  | "integration"
  | "action"
  | "memory"
  | "resource"
  | "blank"
  | "deck"
  | "villager"
  | "task"
  | "modifier"
  | "loot"
  ;

export type CardDefId = string;

export type CardDef = {
  id: CardDefId;
  kind: CardKind;
  title: string;
  icon: string;
  skin: string;
  leftBadge?: string;
  rightBadge?: string;
};

export type CardData = Record<string, unknown>;

export type StackId = EntityId;
export type CardId = EntityId;


```


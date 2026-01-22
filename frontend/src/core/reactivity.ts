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
    queueMicrotask(flush);
  }
}

function flush() {
  try {
    // drain in insertion order
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

// Allow explicit batching (optional; scheduler already batches by default)
let batchDepth = 0;
function flushIfNeeded() {
  if (batchDepth === 0 && queue.size > 0 && !flushing) {
    flushing = true;
    queueMicrotask(flush);
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
  // detach from deps
  for (const dep of c.deps) dep.observers.delete(c);
  c.deps.clear();

  // run user cleanups
  for (const cl of c.cleanups) {
    try {
      cl();
    } catch (err) {
      // best-effort; don't break reactivity if a cleanup throws
      console.error("cleanup error:", err);
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
  return {
    fn,
    deps: new Set(),
    cleanups: [],
    scheduled: false,
    disposed: false,
  };
}

// --- public API ---

export function createSignal<T>(
  initial: T,
  opts?: { equals?: (a: T, b: T) => boolean }
): Signal<T> {
  const s: SignalImpl<T> = {
    value: initial,
    observers: new Set(),
    equals: opts?.equals,
  };

  const read: Accessor<T> = () => {
    if (Current && !Current.disposed) {
      // track: signal -> computation and computation -> signal
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

    // notify observers
    for (const obs of s.observers) schedule(obs);

    // if we are inside a manual batch, don't flush until batch ends;
    // otherwise the microtask scheduler handles it.
    if (batchDepth === 0) flushIfNeeded();

    return s.value;
  };

  return [read, write];
}

export function createEffect(fn: () => void): Disposer {
  const c = createComputation(fn);
  run(c);
  return () => disposeComputation(c);
}

export function createMemo<T>(
  fn: () => T,
  initial?: T,
  opts?: { equals?: (a: T, b: T) => boolean }
): Accessor<T> {
  const [get, set] = createSignal<T>(initial as T, opts);

  const c = createComputation(() => {
    // compute and write into inner signal
    set(fn());
  });

  run(c);

  // tie memo lifetime to whoever holds accessor (manual disposal pattern)
  // If you need explicit disposal, wrap with createRoot below.
  // For now, memo stays alive; this matches how you'll use it in your board.
  // You can upgrade later with createRoot/owners.
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

function disposeComputation(c: Computation) {
  if (c.disposed) return;
  c.disposed = true;
  queue.delete(c);
  cleanupComputation(c);
}

// --- Optional: createRoot for scoped disposal (handy for DOM nodes) ---
//
// Usage:
// const dispose = createRoot((dispose) => {
//   createEffect(...);
//   return dispose;
// });
// dispose(); // disposes all effects created inside root
//
// This is a lightweight owner-style scope (not full Solid owner graph, but good enough).
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
        console.error("dispose error:", err);
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

// Wrap createEffect so effects created inside a root are auto-disposed.
export function createEffectInRoot(fn: () => void): Disposer {
  const d = createEffect(fn);
  if (CurrentRoot) CurrentRoot.disposers.add(d);
  return () => {
    if (CurrentRoot) CurrentRoot.disposers.delete(d);
    d();
  };
}

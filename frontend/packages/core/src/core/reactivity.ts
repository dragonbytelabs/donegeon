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



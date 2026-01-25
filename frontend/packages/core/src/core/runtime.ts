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



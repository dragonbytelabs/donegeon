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



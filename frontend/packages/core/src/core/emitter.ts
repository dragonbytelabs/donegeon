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



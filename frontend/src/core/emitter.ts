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
    // copy to avoid issues if handlers unsubscribe while iterating
    for (const fn of Array.from(this.subs)) fn(event);
  }

  clear() {
    this.subs.clear();
  }

  get size() {
    return this.subs.size;
  }
}

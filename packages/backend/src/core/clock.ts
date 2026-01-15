export type Clock = {
  now(): Date;
};

export const systemClock: Clock = {
  now: () => new Date()
};

// Bun runtime TS loader can behave oddly with `interface` + `implements` exports.
// Keep this class simple and explicitly exported.
export class MutableClock {
  private _now: Date;

  constructor(start: Date) {
    this._now = new Date(start);
  }

  now(): Date {
    return new Date(this._now);
  }

  set(d: Date) {
    this._now = new Date(d);
  }

  addDays(days: number) {
    this._now = new Date(this._now.getTime() + days * 86400000);
  }
}

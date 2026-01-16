import { describe, expect, test } from "bun:test";
import { applyMove } from "./apply.js";

describe("rules: board (v0.2)", () => {
  test("applyMove snaps to grid and updates position", () => {
    const state = {
      gridSize: 100,
      entities: {
        e1: { id: "e1", kind: "card", pos: { x: 0, y: 0 }, card_type: "blank_task" }
      }
    } as const;

    const res = applyMove(state as any, { kind: "move_entity", entity_id: "e1", to: { x: 149, y: 151 } });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.next.entities.e1.pos).toEqual({ x: 100, y: 200 });
    }
  });

  test("applyMove wiggles away from occupied positions", () => {
    const state = {
      gridSize: 100,
      entities: {
        a: { id: "a", kind: "card", pos: { x: 0, y: 0 }, card_type: "blank_task" },
        b: { id: "b", kind: "deck", pos: { x: 100, y: 0 }, deck_id: "deck_first_day" }
      }
    } as const;

    const res = applyMove(state as any, { kind: "move_entity", entity_id: "a", to: { x: 100, y: 0 } });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.events?.[0]?.kind).toBe("wiggle");
    expect(res.next.entities.a.pos).not.toEqual({ x: 100, y: 0 });
  });
});


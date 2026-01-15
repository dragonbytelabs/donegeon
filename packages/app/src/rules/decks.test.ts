import { describe, expect, test } from "bun:test";
import { openDeck } from "./decks.js";
import { defaultBalance } from "./balance.js";
import { mulberry32 } from "./rng.js";

describe("rules: decks (state-machine flavored)", () => {
  test("openDeck is deterministic given seed", () => {
    const seed = 1337;
    const rng1 = mulberry32(seed);
    const rng2 = mulberry32(seed);

    const baseInput = {
      deck: { id: "deck_first_day", type: "first_day" as const, status: "unlocked" as const, baseCost: 0, timesOpened: 0 },
      worldTasksProcessed: 0,
      econ: { coin: 0, packCostPct: 0 },
      cfg: defaultBalance
    };

    const a = openDeck({ ...baseInput, rng: rng1 });
    const b = openDeck({ ...baseInput, rng: rng2 });

    expect(a.picks).toEqual(b.picks);
    expect(a.transition).toEqual(b.transition);
    expect(a.cost).toBe(b.cost);
    expect(a.was_free).toBe(true);
  });

  test("openDeck returns clockwise ring offsets count matching draw count", () => {
    const rng = mulberry32(1);
    const res = openDeck({
      deck: { id: "deck_first_day", type: "first_day", status: "unlocked", baseCost: 0, timesOpened: 0 },
      worldTasksProcessed: 0,
      econ: { coin: 0, packCostPct: 0 },
      rng,
      cfg: defaultBalance
    });

    expect(res.transition.pattern).toBe("clockwise_ring");
    expect(res.transition.card_count).toBe(defaultBalance.deckOpenDrawCount);
    expect(res.transition.offsets.length).toBe(defaultBalance.deckOpenDrawCount);
  });

  test("locked decks cannot be opened until unlock threshold met", () => {
    const rng = mulberry32(2);
    expect(() =>
      openDeck({
        deck: { id: "deck_planning", type: "planning", status: "locked", baseCost: 4, timesOpened: 0 },
        worldTasksProcessed: defaultBalance.deckUnlockPlanningTasks - 1,
        econ: { coin: 999, packCostPct: 0 },
        rng,
        cfg: defaultBalance
      })
    ).toThrow("deck is locked");
  });
});


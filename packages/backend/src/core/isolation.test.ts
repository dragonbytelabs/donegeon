import { expect, test, describe } from "bun:test";
import { honoApp as app } from "../index.js";

describe("Per-player isolation", () => {
  test("Two players have separate board states", async () => {
    const player1 = "test_player_1";
    const player2 = "test_player_2";

    // Get initial board states for both players
    const req1a = new Request("http://localhost:3000/api/board/state", {
      headers: { "X-Donegeon-Player": player1 }
    });
    const req2a = new Request("http://localhost:3000/api/board/state", {
      headers: { "X-Donegeon-Player": player2 }
    });

    const res1a = await app.fetch(req1a);
    const res2a = await app.fetch(req2a);

    expect(res1a.status).toBe(200);
    expect(res2a.status).toBe(200);

    const board1a = await res1a.json();
    const board2a = await res2a.json();

    // Both should have villagers spawned (auto-spawn logic)
    expect(board1a.entities.length).toBeGreaterThan(0);
    expect(board2a.entities.length).toBeGreaterThan(0);

    // Spawn a deck for player 1
    const req1b = new Request("http://localhost:3000/api/board/spawn-deck", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Donegeon-Player": player1 },
      body: JSON.stringify({ deck_id: "deck_first_day" })
    });

    const res1b = await app.fetch(req1b);
    expect(res1b.status).toBe(200);
    const result1b = await res1b.json();
    const board1b = result1b.state;

    // Player 1 should now have more entities (villagers + deck)
    expect(board1b.entities.length).toBeGreaterThan(board1a.entities.length);

    // Player 2's board should be unchanged
    const req2b = new Request("http://localhost:3000/api/board/state", {
      headers: { "X-Donegeon-Player": player2 }
    });
    const res2b = await app.fetch(req2b);
    const board2b = await res2b.json();

    expect(board2b.entities.length).toBe(board2a.entities.length);

    // Verify no deck in player 2's board
    const player2HasDeck = board2b.entities.some((e: any) => e.kind === "deck");
    expect(player2HasDeck).toBe(false);

    // Verify deck exists in player 1's board
    const player1HasDeck = board1b.entities.some((e: any) => e.kind === "deck");
    expect(player1HasDeck).toBe(true);
  });

  test.skip("Two players have separate loot inventories", async () => {
    // NOTE: This test is skipped because loot/villager/task repos are currently shared globally.
    // Only board state is isolated per player (v0.7). Full per-player isolation requires refactoring the state system.
    const player1 = "test_loot_1";
    const player2 = "test_loot_2";

    // Get initial loot for both players
    const req1a = new Request("http://localhost:3000/api/loot", {
      headers: { "X-Donegeon-Player": player1 }
    });
    const req2a = new Request("http://localhost:3000/api/loot", {
      headers: { "X-Donegeon-Player": player2 }
    });

    const res1a = await app.fetch(req1a);
    const res2a = await app.fetch(req2a);

    const loot1a = await res1a.json();
    const loot2a = await res2a.json();

    const initialCoin1 = loot1a.coin;
    const initialCoin2 = loot2a.coin;

    // Add loot to player 1
    const req1b = new Request("http://localhost:3000/api/loot/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Donegeon-Player": player1 },
      body: JSON.stringify({ loot_type: "coin", amount: 5 })
    });

    const res1b = await app.fetch(req1b);
    expect(res1b.status).toBe(200);

    // Check player 1's loot increased
    const req1c = new Request("http://localhost:3000/api/loot", {
      headers: { "X-Donegeon-Player": player1 }
    });
    const res1c = await app.fetch(req1c);
    const loot1c = await res1c.json();

    expect(loot1c.coin).toBe(initialCoin1 + 5);

    // Check player 2's loot unchanged
    const req2b = new Request("http://localhost:3000/api/loot", {
      headers: { "X-Donegeon-Player": player2 }
    });
    const res2b = await app.fetch(req2b);
    const loot2b = await res2b.json();

    expect(loot2b.coin).toBe(initialCoin2);
  });

  test.skip("Two players have separate villager states", async () => {
    // NOTE: See loot test - same limitation applies.
    const player1 = "test_villagers_1";
    const player2 = "test_villagers_2";

    // Get initial villagers for both players
    const req1a = new Request("http://localhost:3000/api/villagers", {
      headers: { "X-Donegeon-Player": player1 }
    });
    const req2a = new Request("http://localhost:3000/api/villagers", {
      headers: { "X-Donegeon-Player": player2 }
    });

    const res1a = await app.fetch(req1a);
    const res2a = await app.fetch(req2a);

    const villagers1a = await res1a.json();
    const villagers2a = await res2a.json();

    // Both players should have villagers
    expect(villagers1a.length).toBeGreaterThan(0);
    expect(villagers2a.length).toBeGreaterThan(0);

    // Modify player 1's villager stamina via day tick
    const req1b = new Request("http://localhost:3000/api/day/tick", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Donegeon-Player": player1 },
      body: JSON.stringify({})
    });

    await app.fetch(req1b);

    // Get villagers again
    const req1c = new Request("http://localhost:3000/api/villagers", {
      headers: { "X-Donegeon-Player": player1 }
    });
    const req2b = new Request("http://localhost:3000/api/villagers", {
      headers: { "X-Donegeon-Player": player2 }
    });

    const res1c = await app.fetch(req1c);
    const res2b = await app.fetch(req2b);

    const villagers1c = await res1c.json();
    const villagers2b = await res2b.json();

    // Player 1's villagers might have stamina changes, but player 2's should be exactly the same as initial
    expect(JSON.stringify(villagers2b)).toBe(JSON.stringify(villagers2a));
  });
});

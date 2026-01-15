import { describe, expect, test, beforeEach } from "bun:test";
import { honoApp } from "../index.js";
import { configureAppStateForTests, resetAppStateForTests } from "../core/state.js";

async function json(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function req(path: string, init?: RequestInit) {
  return await honoApp.request(path, init);
}

async function post(path: string, body: any) {
  return await req(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

type Task = { id: number; zone: string; completed: boolean; tags: string[]; modifier_ids: string[] };

describe("30-day simulation (API-driven, deterministic)", () => {
  beforeEach(() => {
    // deterministic: fixed seed + start date
    configureAppStateForTests({ seed: 1337, start: new Date("2026-01-01T00:00:00.000Z") });
  });

  test("runs 30 day ticks and exercises all endpoints meaningfully", async () => {
    // --- One-time “tour” calls (ensures endpoints reachable)
    expect((await req("/healthz")).status).toBe(200);
    expect((await req("/api/version")).status).toBe(200);
    expect((await req("/api/world")).status).toBe(200);
    expect((await req("/api/game/state")).status).toBe(200);
    expect((await req("/api/game/remaining-undrawn")).status).toBe(200);
    expect((await req("/api/cards")).status).toBe(200);
    expect((await req("/api/cards/zone/board")).status).toBe(200);
    expect((await req("/api/dev/config")).status).toBe(200);
    expect((await req("/api/dev/stats")).status).toBe(200);
    expect((await req("/api/quests")).status).toBe(200);
    expect((await req("/api/quests/active")).status).toBe(200);
    expect((await req("/api/quests/daily")).status).toBe(200);
    expect((await req("/api/recipes")).status).toBe(200);
    expect((await req("/api/buildings")).status).toBe(200);
    expect((await req("/api/projects")).status).toBe(200);

    // Seed some projects/buildings/recipes interactions early.
    const project = await json(
      await post("/api/projects", { name: "Season 1", description: "Spring foundation" })
    );
    expect(project.id).toBeDefined();
    expect((await post(`/api/projects/${project.id}/archive`, {})).status).toBe(200);

    expect((await post("/api/buildings/construct", { type: "rest_hall" })).status).toBe(200);
    expect((await post("/api/recipes/craft", { recipe_id: "r_make_omelet" })).status).toBe(200);

    // Ensure modifier-specific endpoints are meaningful: create + then mutate.
    // Create a task to attach these modifiers to.
    const t0 = await json(await post("/api/tasks", { name: "setup", description: "" }));
    await post("/api/tasks/move-to-live", { id: t0.id });
    await post("/api/tasks/modifiers/attach", {
      task_id: t0.id,
      modifier: {
        id: "m_checklist_sim",
        type: "checklist",
        created_at: new Date().toISOString(),
        status: "active",
        max_charges: 0,
        charges: 0,
        checklist_total: 3,
        checklist_completed: 0
      }
    });
    await post("/api/modifiers/checklist/increment", { modifier_id: "m_checklist_sim" });

    await post("/api/tasks/modifiers/attach", {
      task_id: t0.id,
      modifier: {
        id: "m_review_sim",
        type: "review_cadence",
        created_at: new Date().toISOString(),
        status: "active",
        max_charges: 0,
        charges: 0,
        review_every_days: 7,
        review_next_at: new Date(Date.now() + 7 * 86400000).toISOString()
      }
    });
    await post("/api/modifiers/review/set", {
      modifier_id: "m_review_sim",
      review_every_days: 5,
      review_next_at: new Date(Date.now() + 5 * 86400000).toISOString()
    });

    await post("/api/tasks/modifiers/attach", {
      task_id: t0.id,
      modifier: {
        id: "m_wait_sim",
        type: "waiting_on",
        created_at: new Date().toISOString(),
        status: "active",
        max_charges: 0,
        charges: 0
      }
    });
    await post("/api/modifiers/waiting-on/set", {
      modifier_id: "m_wait_sim",
      unblocked_at: new Date().toISOString()
    });

    // --- 30-day loop
    // Strategy:
    // - Open First Day deck daily for the first 5 days
    // - Keep ~2-4 live tasks
    // - Assign/process tasks with villagers
    // - Add tags/priority occasionally (influences stamina cost and loot)
    // - Let some inbox tasks sit to spawn zombies, then clear them
    for (let day = 1; day <= 30; day++) {
      // Touch list endpoints each day (keeps “simulation uses every endpoint” honest)
      expect((await req("/api/tasks")).status).toBe(200);
      expect((await req("/api/tasks/inbox")).status).toBe(200);
      expect((await req("/api/tasks/live")).status).toBe(200);
      expect((await req("/api/tasks/completed")).status).toBe(200);
      expect((await req("/api/villagers")).status).toBe(200);
      expect((await req("/api/zombies")).status).toBe(200);
      expect((await req("/api/decks")).status).toBe(200);
      expect((await req("/api/loot")).status).toBe(200);
      expect((await req("/api/modifiers")).status).toBe(200);
      expect((await req("/api/world")).status).toBe(200);
      expect((await req("/api/today")).status).toBe(200);

      // Deck preview & open
      if (day === 1) {
        expect((await req("/api/decks/deck_first_day/preview")).status).toBe(200);
      }
      if (day <= 5) {
        const opened = await json(await post("/api/decks/deck_first_day/open", {}));
        expect(opened.drops).toBeDefined();
      }

      // Create some tasks
      const live = (await json(await req("/api/tasks/live"))) as Task[];
      const inbox = (await json(await req("/api/tasks/inbox"))) as Task[];

      if (live.length < 2) {
        const created = await json(await post("/api/tasks", { name: `task d${day}-a`, description: "" }));
        await post("/api/tasks/tag", { id: created.id, tag: day % 3 === 0 ? "deep_work" : "admin" });
        await post("/api/tasks/priority", { id: created.id, priority: (day % 4) as any });
        await post("/api/tasks/move-to-live", { id: created.id });
      }

      // Keep at least one inbox task around sometimes to spawn zombies
      if (day % 4 === 0 && inbox.length === 0) {
        await post("/api/tasks", { name: `inbox d${day}`, description: "" });
      }

      // Assign and process at most 2 tasks/day
      const villagerList = await json(await req("/api/villagers"));
      const v1 = villagerList[0]?.id ?? "v1";

      const liveNow = (await json(await req("/api/tasks/live"))) as Task[];
      for (const t of liveNow.slice(0, 2)) {
        await post("/api/tasks/assign", { task_id: t.id, villager_id: v1 });
        // Occasionally attach a modifier via the “add” endpoint
        if (day % 5 === 0 && t.modifier_ids.length === 0) {
          await post("/api/tasks/modifiers/add", { task_id: t.id, type: "importance_seal" });
          const mods = await json(await req(`/api/tasks/${t.id}/modifiers`));
          if (mods.length) {
            await post("/api/tasks/modifiers/remove", { task_id: t.id, modifier_id: mods[0].id });
          }
        }
        await post("/api/tasks/process", { task_id: t.id, villager_id: v1, hours_worked: 1 });
      }

      // Occasionally reorder tasks (noop but should respond)
      if (day % 7 === 0) {
        const all = (await json(await req("/api/tasks"))) as Task[];
        if (all.length >= 2) {
          await post("/api/tasks/reorder", { source_id: all[0].id, target_id: all[1].id });
        }
      }

      // Clear any zombies that exist
      const zombies = await json(await req("/api/zombies"));
      for (const z of zombies.slice(0, 2)) {
        await post("/api/zombies/clear", { zombie_id: z.id, slots: 1 });
      }

      // Progress/quests refresh
      await post("/api/progress", {});
      await post("/api/quests/refresh", {});
      await post("/api/loot/collect", { loot_type: "paper", amount: 0 }); // “use” endpoint without changing state

      // End of day tick
      const tick = await json(await post("/api/day/tick", {}));
      expect(tick.day_index).toBeDefined();
    }

    // At end, ensure we have advanced day_index by 30 ticks from starting day_index=1 → 31
    const w = await json(await req("/api/world"));
    expect(w.day_index).toBe(31);
  });
});


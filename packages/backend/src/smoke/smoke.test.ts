import { describe, expect, test, beforeEach } from "bun:test";
import { honoApp } from "../index.js";
import { resetAppStateForTests } from "../core/state.js";

async function json(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function req(path: string, init?: RequestInit) {
  return await honoApp.request(path, init);
}

describe("backend smoke: every endpoint responds", () => {
  beforeEach(() => {
    resetAppStateForTests();
  });

  test("health + version", async () => {
    const h = await req("/healthz");
    expect(h.status).toBe(200);
    expect(await h.text()).toBe("ok");

    const v = await req("/api/version");
    expect(v.status).toBe(200);
    const body = await json(v);
    expect(body.name).toBe("donegeon-backend");
  });

  test("tasks flow + modifiers + projects + villagers + zombies + decks + loot + quests + recipes + misc", async () => {
    // ---- tasks create/list/inbox
    let r = await req("/api/tasks");
    expect(r.status).toBe(200);
    expect(await json(r)).toEqual([]);

    r = await req("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "pay bills", description: "electric + water" })
    });
    expect(r.status).toBe(200);
    const t1 = await json(r);
    expect(t1.id).toBe(1);

    r = await req("/api/tasks/inbox");
    expect(r.status).toBe(200);
    expect((await json(r)).length).toBe(1);

    // tag/priority
    r = await req("/api/tasks/tag", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: 1, tag: "home" })
    });
    expect(r.status).toBe(200);

    r = await req("/api/tasks/priority", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: 1, priority: 1 })
    });
    expect(r.status).toBe(200);

    // move to live + list live
    r = await req("/api/tasks/move-to-live", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: 1 })
    });
    expect(r.status).toBe(200);

    r = await req("/api/tasks/live");
    expect(r.status).toBe(200);
    expect((await json(r)).length).toBe(1);

    // villagers list
    r = await req("/api/villagers");
    expect(r.status).toBe(200);
    const villagers = await json(r);
    expect(villagers.length).toBeGreaterThanOrEqual(1);

    // assign
    r = await req("/api/tasks/assign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task_id: 1, villager_id: "v1" })
    });
    expect(r.status).toBe(200);

    // process (should complete with our defaults after 1h)
    r = await req("/api/tasks/process", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task_id: 1, villager_id: "v1", hours_worked: 1 })
    });
    expect(r.status).toBe(200);
    const processed = await json(r);
    expect(processed.status).toBe("processed");

    // completed list
    r = await req("/api/tasks/completed");
    expect(r.status).toBe(200);
    expect((await json(r)).length).toBe(1);

    // complete endpoint is idempotent-ish in this model
    r = await req("/api/tasks/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: 1 })
    });
    expect(r.status).toBe(200);

    // ---- modifiers
    r = await req("/api/modifiers");
    expect(r.status).toBe(200);

    // create second task (inbox) to test zombies/day tick and modifier attach/detach
    r = await req("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "inbox task", description: "" })
    });
    expect(r.status).toBe(200);
    const t2 = await json(r);
    expect(t2.id).toBe(2);

    // add modifier
    r = await req("/api/tasks/modifiers/add", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task_id: 2, type: "importance_seal" })
    });
    expect(r.status).toBe(200);

    // list task modifiers
    r = await req("/api/tasks/2/modifiers");
    expect(r.status).toBe(200);
    const mods = await json(r);
    expect(mods.length).toBe(1);
    const modId = mods[0].id as string;

    // detach modifier
    r = await req("/api/tasks/modifiers/remove", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task_id: 2, modifier_id: modId })
    });
    expect(r.status).toBe(200);

    // attach existing modifier (with checklist/review fields so dedicated endpoints are exercisable)
    const attachedModifier = {
      id: "m_checklist_1",
      type: "checklist",
      created_at: new Date().toISOString(),
      status: "active",
      max_charges: 0,
      charges: 0,
      checklist_total: 3,
      checklist_completed: 0
    };
    r = await req("/api/tasks/modifiers/attach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task_id: 2, modifier: attachedModifier })
    });
    expect(r.status).toBe(200);

    // checklist increment
    r = await req("/api/modifiers/checklist/increment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ modifier_id: "m_checklist_1" })
    });
    expect(r.status).toBe(200);
    const inc = await json(r);
    expect(inc.checklist_completed).toBe(1);

    // review cadence set (needs a review modifier)
    const reviewModifier = {
      id: "m_review_1",
      type: "review_cadence",
      created_at: new Date().toISOString(),
      status: "active",
      max_charges: 0,
      charges: 0,
      review_every_days: 7,
      review_next_at: new Date(Date.now() + 7 * 86400000).toISOString()
    };
    r = await req("/api/tasks/modifiers/attach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task_id: 2, modifier: reviewModifier })
    });
    expect(r.status).toBe(200);

    r = await req("/api/modifiers/review/set", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        modifier_id: "m_review_1",
        review_every_days: 5,
        review_next_at: new Date(Date.now() + 5 * 86400000).toISOString()
      })
    });
    expect(r.status).toBe(200);

    // waiting_on set (needs a waiting_on modifier)
    const waitModifier = {
      id: "m_wait_1",
      type: "waiting_on",
      created_at: new Date().toISOString(),
      status: "active",
      max_charges: 0,
      charges: 0
    };
    r = await req("/api/tasks/modifiers/attach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task_id: 2, modifier: waitModifier })
    });
    expect(r.status).toBe(200);

    r = await req("/api/modifiers/waiting-on/set", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ modifier_id: "m_wait_1", unblocked_at: new Date().toISOString() })
    });
    expect(r.status).toBe(200);

    // ---- projects
    r = await req("/api/projects");
    expect(r.status).toBe(200);

    r = await req("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "My Project", description: "Project description" })
    });
    expect(r.status).toBe(200);
    const proj = await json(r);

    // set task project
    r = await req("/api/tasks/set-project", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task_id: 2, project_id: proj.id })
    });
    expect(r.status).toBe(200);

    // archive project
    r = await req(`/api/projects/${proj.id}/archive`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(r.status).toBe(200);

    // ---- decks
    r = await req("/api/decks");
    expect(r.status).toBe(200);
    const decks = await json(r);
    expect(decks.length).toBeGreaterThanOrEqual(1);

    r = await req("/api/decks/deck_first_day/preview");
    expect(r.status).toBe(200);

    r = await req("/api/decks/deck_first_day/open", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(r.status).toBe(200);

    // ---- loot
    r = await req("/api/loot");
    expect(r.status).toBe(200);

    r = await req("/api/loot/collect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ loot_type: "paper", amount: 2 })
    });
    expect(r.status).toBe(200);

    // ---- world / day tick / zombies
    r = await req("/api/world");
    expect(r.status).toBe(200);

    r = await req("/api/day/tick", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(r.status).toBe(200);

    r = await req("/api/zombies");
    expect(r.status).toBe(200);
    const zs = await json(r);
    expect(Array.isArray(zs)).toBe(true);

    // spawn a zombie by leaving inbox task(s) and ticking again
    r = await req("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "inbox zombie bait", description: "" })
    });
    expect(r.status).toBe(200);
    await req("/api/day/tick", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    r = await req("/api/zombies");
    const zs2 = await json(r);
    const zombieId = zs2.length ? zs2[0].id : null;
    if (zombieId) {
      r = await req("/api/zombies/clear", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ zombie_id: zombieId, slots: 1 })
      });
      expect(r.status).toBe(200);
    }

    // ---- quests
    r = await req("/api/quests");
    expect(r.status).toBe(200);

    r = await req("/api/quests/active");
    expect(r.status).toBe(200);

    r = await req("/api/quests/daily");
    expect(r.status).toBe(200);

    r = await req("/api/quests/refresh", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(r.status).toBe(200);

    r = await req("/api/quests/q_daily_create_task/complete", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect([200, 404]).toContain(r.status);

    // ---- recipes
    r = await req("/api/recipes");
    expect(r.status).toBe(200);

    r = await req("/api/recipes/craft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipe_id: "r_make_omelet" })
    });
    expect(r.status).toBe(200);

    // ---- progress
    r = await req("/api/progress", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(r.status).toBe(200);

    // ---- buildings
    r = await req("/api/buildings");
    expect(r.status).toBe(200);

    r = await req("/api/buildings/construct", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "rest_hall" })
    });
    expect(r.status).toBe(200);

    // ---- game/cards/dev
    r = await req("/api/game/state");
    expect(r.status).toBe(200);

    r = await req("/api/game/remaining-undrawn");
    expect(r.status).toBe(200);

    r = await req("/api/today");
    expect(r.status).toBe(200);

    r = await req("/api/cards");
    expect(r.status).toBe(200);

    r = await req("/api/cards/zone/board");
    expect(r.status).toBe(200);

    r = await req("/api/dev/config");
    expect(r.status).toBe(200);

    r = await req("/api/dev/stats");
    expect(r.status).toBe(200);
  });

  test("board endpoints (server state) with playerId", async () => {
    const headers = { "X-Donegeon-Player": "player_smoke_1", "content-type": "application/json" };

    let r = await req("/api/board/state", { headers });
    expect(r.status).toBe(200);

    r = await req("/api/board/spawn-deck", { method: "POST", headers, body: JSON.stringify({ deck_id: "deck_first_day" }) });
    expect(r.status).toBe(200);
    const spawned = await json(r);
    expect(spawned.state).toBeDefined();
    const deckEntity = spawned.state.entities.find((e: any) => e.kind === "deck");
    expect(deckEntity).toBeDefined();

    r = await req("/api/board/open-deck", { method: "POST", headers, body: JSON.stringify({ deck_entity_id: deckEntity.id }) });
    expect(r.status).toBe(200);
    const opened = await json(r);
    expect(opened.state.entities.length).toBeGreaterThan(0);

    const card = opened.state.entities.find((e: any) => e.kind === "card");
    expect(card).toBeDefined();
    r = await req("/api/board/move", { method: "POST", headers, body: JSON.stringify({ entity_id: card.id, x: 123, y: 456 }) });
    expect(r.status).toBe(200);
  });
});


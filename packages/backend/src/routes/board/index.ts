import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { stateFromContext } from "../../core/state.js";
import { playerIdFromContext, requirePlayerId, type PlayerEnv } from "./_player.js";
import type { BoardStateDto, BoardEntityDto, BoardEventDto, DeckOpenTransitionDto } from "@donegeon/app/api";
import { applyMove, applyStack, applyUnstack } from "@donegeon/app/rules";

export const boardRouter = new Hono<PlayerEnv>();

boardRouter.use("*", requirePlayerId);

function dtoToState(dto: BoardStateDto) {
  const entities: any = {};
  for (const e of dto.entities) {
    if (e.kind === "deck") entities[e.id] = { id: e.id, kind: "deck", pos: { x: e.x, y: e.y }, deck_id: e.deck_id, stack_id: e.stack_id };
    else entities[e.id] = { id: e.id, kind: "card", pos: { x: e.x, y: e.y }, card_type: e.card_type, subtype: e.subtype, payload: e.payload, stack_id: e.stack_id };
  }
  const stacks: any = {};
  for (const s of dto.stacks) stacks[s.id] = { id: s.id, task_id: s.task_id, attached_ids: [...s.attached_ids] };
  return { gridSize: dto.grid_size, entities, stacks };
}

function stateToDto(st: any): BoardStateDto {
  const entities: BoardEntityDto[] = [];
  for (const e of Object.values(st.entities) as any[]) {
    if (e.kind === "deck") entities.push({ id: e.id, kind: "deck", deck_id: e.deck_id, x: e.pos.x, y: e.pos.y, stack_id: e.stack_id });
    else
      entities.push({
        id: e.id,
        kind: "card",
        card_type: e.card_type,
        subtype: e.subtype,
        x: e.pos.x,
        y: e.pos.y,
        stack_id: e.stack_id,
        payload: e.payload
      });
  }
  const stacks = Object.values(st.stacks).map((s: any) => ({ id: s.id, task_id: s.task_id, attached_ids: [...s.attached_ids] }));
  return { grid_size: st.gridSize, entities, stacks };
}

boardRouter.get("/board/state", (c) => {
  const st = stateFromContext(c);
  const pid = playerIdFromContext(c);
  const dto = st.boardRepo.get(pid);
  return c.json(dto);
});

boardRouter.post(
  "/board/spawn-deck",
  zValidator(
    "json",
    z.object({
      deck_id: z.string()
    })
  ),
  (c) => {
    const st = stateFromContext(c);
    const pid = playerIdFromContext(c);
    const dto = st.boardRepo.get(pid);
    const board = dtoToState(dto);
    const { deck_id } = c.req.valid("json");

    // naive open position search: random-ish scan
    const id = `deck_${Date.now()}`;
    const tries = 200;
    let x = 0;
    let y = 0;
    for (let i = 0; i < tries; i++) {
      x = (Math.floor(Math.random() * 20) - 10) * board.gridSize;
      y = (Math.floor(Math.random() * 10) - 5) * board.gridSize;
      const occupied = Object.values(board.entities).some((e: any) => e.pos.x === x && e.pos.y === y);
      if (!occupied) break;
    }

    board.entities[id] = { id, kind: "deck", pos: { x, y }, deck_id };
    const nextDto = stateToDto(board);
    st.boardRepo.set(pid, nextDto);
    return c.json({ state: nextDto, events: [] satisfies BoardEventDto[] });
  }
);

boardRouter.post(
  "/board/move",
  zValidator(
    "json",
    z.object({
      entity_id: z.string(),
      x: z.number(),
      y: z.number()
    })
  ),
  (c) => {
    const st = stateFromContext(c);
    const pid = playerIdFromContext(c);
    const dto = st.boardRepo.get(pid);
    const board = dtoToState(dto);
    const body = c.req.valid("json");
    const moving: any = board.entities[body.entity_id];
    if (!moving) return c.json({ error: "not_found" }, 404);

    // If entity is part of a stack, move the whole stack together.
    const stackId = moving.stack_id as string | undefined;
    if (stackId) {
      const members = Object.values(board.entities) as any[];
      const stackMembers = members.filter((e) => e?.stack_id === stackId);
      // Move the requested entity with snapping/legality, then apply same delta to others.
      const before = { ...moving.pos };
      const res = applyMove(board, { kind: "move_entity", entity_id: body.entity_id, to: { x: body.x, y: body.y } });
      if (!res.ok) return c.json({ error: res.reason }, 400);
      const after = (res.next.entities as any)[body.entity_id].pos;
      const dx = after.x - before.x;
      const dy = after.y - before.y;
      for (const m of stackMembers) {
        if (m?.id === body.entity_id) continue;
        (res.next.entities as any)[m.id] = { ...m, pos: { x: m.pos.x + dx, y: m.pos.y + dy } };
      }
      const nextDto = stateToDto(res.next);
      st.boardRepo.set(pid, nextDto);
      return c.json({ state: nextDto, events: [] satisfies BoardEventDto[] });
    }

    const res = applyMove(board, { kind: "move_entity", entity_id: body.entity_id, to: { x: body.x, y: body.y } });
    if (!res.ok) return c.json({ error: res.reason }, 400);
    const nextDto = stateToDto(res.next);
    st.boardRepo.set(pid, nextDto);
    return c.json({ state: nextDto, events: [] satisfies BoardEventDto[] });
  }
);

boardRouter.post(
  "/board/stack",
  zValidator("json", z.object({ source_id: z.string(), target_id: z.string() })),
  (c) => {
    const st = stateFromContext(c);
    const pid = playerIdFromContext(c);
    const dto = st.boardRepo.get(pid);
    const board = dtoToState(dto);
    const body = c.req.valid("json");
    const res = applyStack(board, { kind: "stack", source_id: body.source_id, target_id: body.target_id });
    if (!res.ok) return c.json({ error: res.reason }, 400);
    const nextDto = stateToDto(res.next);
    st.boardRepo.set(pid, nextDto);
    return c.json({ state: nextDto, events: [{ kind: "stacked", stack_id: (res.next.entities[body.target_id] as any).stack_id ?? "", entity_ids: [body.source_id, body.target_id] }] satisfies BoardEventDto[] });
  }
);

boardRouter.post(
  "/board/unstack",
  zValidator("json", z.object({ stack_id: z.string() })),
  (c) => {
    const st = stateFromContext(c);
    const pid = playerIdFromContext(c);
    const dto = st.boardRepo.get(pid);
    const board = dtoToState(dto);
    const body = c.req.valid("json");
    const res = applyUnstack(board, { kind: "unstack", stack_id: body.stack_id });
    if (!res.ok) return c.json({ error: res.reason }, 400);
    const nextDto = stateToDto(res.next);
    st.boardRepo.set(pid, nextDto);
    return c.json({ state: nextDto, events: [{ kind: "unstacked", stack_id: body.stack_id, entity_ids: [] }] satisfies BoardEventDto[] });
  }
);

boardRouter.post(
  "/board/open-deck",
  zValidator("json", z.object({ deck_entity_id: z.string() })),
  (c) => {
    const st = stateFromContext(c);
    const pid = playerIdFromContext(c);
    const dto = st.boardRepo.get(pid);
    const board = dtoToState(dto);
    const { deck_entity_id } = c.req.valid("json");
    const deckEnt = board.entities[deck_entity_id];
    if (!deckEnt || (deckEnt as any).kind !== "deck") return c.json({ error: "deck not found" }, 404);

    const opened = st.engine.openDeck((deckEnt as any).deck_id);
    const transition = opened.transition as DeckOpenTransitionDto | undefined;

    // create card entities at deck origin then place them around using offsets
    const base = (deckEnt as any).pos;
    const createdIds: string[] = [];
    for (let i = 0; i < opened.drops.length; i++) {
      const drop = opened.drops[i]!;
      const id = `card_${Date.now()}_${i}`;
      createdIds.push(id);
      const card_type =
        drop.type === "blank_task" ? "task" : drop.type === "loot" ? "loot" : drop.type === "modifier" ? "modifier" : drop.type === "resource" ? "resource" : "loot";
      const subtype =
        drop.type === "loot"
          ? String(drop.loot_type)
          : drop.type === "resource"
            ? String(drop.resource_card?.resource_type ?? "")
            : drop.type === "modifier"
              ? String(drop.modifier_card?.type ?? "")
              : undefined;
      board.entities[id] = { id, kind: "card", pos: { ...base }, card_type, subtype, payload: drop };
    }

    // remove deck entity
    delete board.entities[deck_entity_id];

    // apply fan-out positions if we have transition
    if (transition) {
      const radius = 180;
      for (let i = 0; i < createdIds.length; i++) {
        const cid = createdIds[i]!;
        const off = transition.offsets[i % transition.offsets.length]!;
        (board.entities[cid] as any).pos = { x: base.x + off.dx * radius, y: base.y + off.dy * radius };
      }
    }

    const nextDto = stateToDto(board);
    st.boardRepo.set(pid, nextDto);

    const events: BoardEventDto[] = transition
      ? [{ kind: "deck_open_fanout", deck_entity_id, card_entity_ids: createdIds, transition }]
      : [];

    return c.json({ state: nextDto, events });
  }
);

boardRouter.post(
  "/board/collect",
  zValidator("json", z.object({ entity_id: z.string() })),
  (c) => {
    const st = stateFromContext(c);
    const pid = playerIdFromContext(c);
    const dto = st.boardRepo.get(pid);
    const board = dtoToState(dto);
    const { entity_id } = c.req.valid("json");
    const ent: any = board.entities[entity_id];
    if (!ent || ent.kind !== "card") return c.json({ error: "card not found" }, 404);
    if (ent.card_type !== "loot") return c.json({ error: "not a loot card" }, 400);
    const loot_type = ent.payload?.loot_type;
    const loot_amount = ent.payload?.loot_amount ?? 1;
    if (typeof loot_type !== "string") return c.json({ error: "loot_type missing" }, 400);
    st.lootRepo.addOne(loot_type as any, Number(loot_amount) || 1);
    delete board.entities[entity_id];
    const nextDto = stateToDto(board);
    st.boardRepo.set(pid, nextDto);
    const events: BoardEventDto[] = [{ kind: "collected", entity_id }];
    return c.json({ state: nextDto, events });
  }
);

boardRouter.post(
  "/board/sell",
  zValidator("json", z.object({ entity_id: z.string() })),
  (c) => {
    const st = stateFromContext(c);
    const pid = playerIdFromContext(c);
    const dto = st.boardRepo.get(pid);
    const board = dtoToState(dto);
    const { entity_id } = c.req.valid("json");
    const ent: any = board.entities[entity_id];
    if (!ent || ent.kind !== "card") return c.json({ error: "card not found" }, 404);

    // Minimal sell rules (v0.6 MVP):
    // - Loot card: same as collect
    // - Modifier/resource/food/task: sell for 1 coin
    // - Villager: not sellable
    if (ent.card_type === "villager") return c.json({ error: "villager not sellable" }, 400);

    let loot_type = "coin";
    let loot_amount = 1;
    if (ent.card_type === "loot") {
      loot_type = String(ent.payload?.loot_type ?? "coin");
      loot_amount = Number(ent.payload?.loot_amount ?? 1) || 1;
    }

    st.lootRepo.addOne(loot_type as any, loot_amount);
    delete board.entities[entity_id];
    const nextDto = stateToDto(board);
    st.boardRepo.set(pid, nextDto);
    const events: BoardEventDto[] = [{ kind: "sold", entity_id, loot_type, loot_amount }];
    return c.json({ state: nextDto, events });
  }
);

boardRouter.post(
  "/board/assign-task",
  zValidator("json", z.object({ task_id: z.number(), villager_id: z.string() })),
  (c) => {
    const st = stateFromContext(c);
    const body = c.req.valid("json");
    const v = st.villagerRepo.get(body.villager_id);
    if (!v) return c.json({ error: "villager not found" }, 404);
    const t = st.taskRepo.get(body.task_id);
    if (!t) return c.json({ error: "task not found" }, 404);

    let staminaCost = 1;
    for (const tag of t.tags) {
      if (tag === "deep_work") staminaCost = 3;
      if (tag === "meeting") staminaCost = 2;
    }
    if (v.stamina < staminaCost) return c.json({ error: "villager has insufficient stamina" }, 400);

    v.stamina -= staminaCost;
    st.villagerRepo.update(v);

    (t as any).assigned_villager = v.id;
    if (t.zone !== "live") st.taskRepo.processToLive(t.id);
    st.taskRepo.update(t);

    return c.json({ status: "assigned", task: t, villager: v });
  }
);

boardRouter.post(
  "/board/complete-task",
  zValidator("json", z.object({ task_id: z.number() })),
  (c) => {
    const st = stateFromContext(c);
    const body = c.req.valid("json");
    try {
      const res = st.engine.completeTask(body.task_id);
      return c.json(res);
    } catch (e: any) {
      return c.json({ error: String(e?.message ?? e) }, 400);
    }
  }
);

boardRouter.post(
  "/board/clear-zombie",
  zValidator("json", z.object({ zombie_id: z.string(), slots: z.number().int().min(1).default(1) })),
  (c) => {
    const st = stateFromContext(c);
    const body = c.req.valid("json");
    try {
      const res = st.engine.clearZombie(body.zombie_id, body.slots);
      return c.json(res);
    } catch (e: any) {
      return c.json({ error: String(e?.message ?? e) }, 400);
    }
  }
);

boardRouter.post(
  "/board/feed",
  zValidator("json", z.object({ villager_id: z.string(), food_entity_id: z.string() })),
  (c) => {
    const st = stateFromContext(c);
    const pid = playerIdFromContext(c);
    const dto = st.boardRepo.get(pid);
    const board = dtoToState(dto);
    const body = c.req.valid("json");

    const v = st.villagerRepo.get(body.villager_id);
    if (!v) return c.json({ error: "villager not found" }, 404);

    const ent: any = board.entities[body.food_entity_id];
    if (!ent || ent.kind !== "card") return c.json({ error: "food card not found" }, 404);
    if (ent.card_type !== "food") return c.json({ error: "not a food card" }, 400);

    if (v.stamina >= v.max_stamina) {
      return c.json({ status: "rejected", reason: "villager at full stamina" }, 200);
    }

    const restore = Number(ent.payload?.stamina_restore ?? 1) || 1;
    v.stamina = Math.min(v.max_stamina, v.stamina + restore);
    st.villagerRepo.update(v);

    delete board.entities[body.food_entity_id];
    const nextDto = stateToDto(board);
    st.boardRepo.set(pid, nextDto);

    const events: BoardEventDto[] = [{ kind: "consumed", entity_id: body.food_entity_id }];
    return c.json({ state: nextDto, villager: v, events });
  }
);


import type { BoardState } from "./types.js";
import { defaultBalance } from "../balance.js";

export type LootDelta = { loot_type: string; loot_amount: number };

export type ZoneApplyResult =
  | {
      ok: true;
      next: BoardState;
      events: Array<
        | { kind: "collected"; entity_id: string }
        | { kind: "sold"; entity_id: string; loot_type: string; loot_amount: number }
        | { kind: "trashed"; entity_id: string }
      >;
      loot?: LootDelta;
    }
  | { ok: false; reason: "not_found" | "not_allowed" };

export function applyCollectZone(state: BoardState, entity_id: string): ZoneApplyResult {
  const ent: any = state.entities[entity_id];
  if (!ent || ent.kind !== "card") return { ok: false, reason: "not_found" };
  if (ent.card_type !== "loot") return { ok: false, reason: "not_allowed" };
  const loot_type = String(ent.payload?.loot_type ?? ent.subtype ?? "");
  const loot_amount = Number(ent.payload?.loot_amount ?? 1) || 1;
  if (!loot_type) return { ok: false, reason: "not_allowed" };

  const nextEntities: any = { ...state.entities };
  delete nextEntities[entity_id];

  return {
    ok: true,
    next: { ...state, entities: nextEntities },
    loot: { loot_type, loot_amount },
    events: [{ kind: "collected", entity_id }]
  };
}

export function applySellZone(state: BoardState, entity_id: string): ZoneApplyResult {
  const ent: any = state.entities[entity_id];
  if (!ent || ent.kind !== "card") return { ok: false, reason: "not_found" };
  if (ent.card_type === "villager") return { ok: false, reason: "not_allowed" };

  const balance = defaultBalance;
  let loot_type = "coin";
  let loot_amount = balance.sellCardCoinReward;

  // If it's a loot card and passthrough is enabled, give the loot itself instead of coins
  if (ent.card_type === "loot" && balance.sellLootPassthrough) {
    loot_type = String(ent.payload?.loot_type ?? ent.subtype ?? "coin");
    loot_amount = Number(ent.payload?.loot_amount ?? 1) || 1;
  }

  const nextEntities: any = { ...state.entities };
  delete nextEntities[entity_id];

  return {
    ok: true,
    next: { ...state, entities: nextEntities },
    loot: { loot_type, loot_amount },
    events: [{ kind: "sold", entity_id, loot_type, loot_amount }]
  };
}

export function applyTrashZone(state: BoardState, entity_id: string): ZoneApplyResult {
  const ent: any = state.entities[entity_id];
  if (!ent || ent.kind !== "card") return { ok: false, reason: "not_found" };
  // Can't trash villagers
  if (ent.card_type === "villager") return { ok: false, reason: "not_allowed" };

  const nextEntities: any = { ...state.entities };
  delete nextEntities[entity_id];

  return {
    ok: true,
    next: { ...state, entities: nextEntities },
    events: [{ kind: "trashed", entity_id }]
  };
}


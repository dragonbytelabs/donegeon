import type { BalanceConfig } from "./balance.js";
import { defaultBalance } from "./balance.js";
import type { Rng } from "./rng.js";

export type DeckType = "first_day" | "organization" | "maintenance" | "planning" | "integration";

export type DeckStatus = "locked" | "unlocked";

export type DeckDefinitionEntry = { type: string; weight: number };
export type DeckDefinition = { contents: DeckDefinitionEntry[] };

// Canonical deck weights (derived from packages/docs/DECKS.md)
export const deckDefinitions: Record<DeckType, DeckDefinition> = {
  first_day: {
    contents: [
      { type: "blank_task", weight: 30 },
      { type: "loot:coin", weight: 25 },
      { type: "loot:paper", weight: 15 },
      { type: "resource:berry_bush", weight: 15 },
      { type: "modifier:next_action", weight: 10 },
      { type: "modifier:checklist", weight: 5 }
    ]
  },
  organization: {
    contents: [
      { type: "modifier:next_action", weight: 25 },
      { type: "modifier:review_cadence", weight: 25 },
      { type: "modifier:checklist", weight: 20 },
      { type: "modifier:recurring_contract", weight: 15 },
      { type: "modifier:importance_seal", weight: 10 },
      { type: "blank_task", weight: 5 }
    ]
  },
  maintenance: {
    contents: [
      { type: "modifier:recurring_contract", weight: 30 },
      { type: "modifier:waiting_on", weight: 25 },
      { type: "modifier:review_cadence", weight: 20 },
      { type: "modifier:deadline_pin", weight: 15 },
      { type: "loot:gear", weight: 5 },
      { type: "blank_task", weight: 5 }
    ]
  },
  planning: {
    contents: [
      { type: "modifier:next_action", weight: 30 },
      { type: "modifier:checklist", weight: 25 },
      { type: "modifier:schedule_token", weight: 20 },
      { type: "loot:blueprint_shard", weight: 15 },
      { type: "loot:paper", weight: 10 }
    ]
  },
  integration: {
    contents: [
      { type: "loot:parts", weight: 45 },
      { type: "loot:blueprint_shard", weight: 35 },
      { type: "loot:gear", weight: 20 }
    ]
  }
};

export type DeckRuntimeState = {
  id: string;
  type: DeckType;
  status: DeckStatus;
  baseCost: number;
  timesOpened: number;
};

export type EconomyState = {
  coin: number;
  packCostPct: number;
};

export type DeckOpenTransition = {
  kind: "deck_open";
  deck_id: string;
  pattern: "clockwise_ring";
  card_count: number;
  // offsets relative to deck origin (0,0). UI maps to pixels.
  offsets: Array<{ order: number; dx: number; dy: number }>;
};

export type DeckOpenResult = {
  cost: number;
  was_free: boolean;
  transition: DeckOpenTransition;
  // chosen entries (backend materializes these into concrete cards/resources/modifiers)
  picks: Array<{ type: string }>;
  next: {
    deck: DeckRuntimeState;
  };
};

export function deckUnlockRequiredTasks(cfg: BalanceConfig, deckType: DeckType): number {
  switch (deckType) {
    case "organization":
      return cfg.deckUnlockOrganizationTasks;
    case "maintenance":
      return cfg.deckUnlockMaintenanceTasks;
    case "planning":
      return cfg.deckUnlockPlanningTasks;
    case "integration":
      return cfg.deckUnlockIntegrationTasks;
    case "first_day":
      return 0;
  }
}

export function computeDeckStatus(cfg: BalanceConfig, deckType: DeckType, worldTasksProcessed: number): DeckStatus {
  if (deckType === "first_day") return "unlocked";
  const req = deckUnlockRequiredTasks(cfg, deckType);
  return worldTasksProcessed >= req ? "unlocked" : "locked";
}

export function computeDeckCost(econ: EconomyState, deckBaseCost: number): number {
  const costMultiplier = 1 + econ.packCostPct / 100;
  return Math.ceil(deckBaseCost * costMultiplier);
}

function pickWeighted(rng: Rng, items: DeckDefinitionEntry[]): DeckDefinitionEntry {
  const total = items.reduce((acc, it) => acc + it.weight, 0);
  const r = rng.next() * total;
  let cur = 0;
  for (const it of items) {
    cur += it.weight;
    if (r <= cur) return it;
  }
  return items[items.length - 1];
}

function clockwiseRingOffsets(count: number): Array<{ order: number; dx: number; dy: number }> {
  // Unit circle, clockwise starting at angle 0 (to the right). UI scales these.
  const out: Array<{ order: number; dx: number; dy: number }> = [];
  const r = 1;
  for (let i = 0; i < count; i++) {
    const theta = (2 * Math.PI * i) / count;
    // clockwise means -sin for y if you treat screen y as down.
    out.push({ order: i, dx: Math.cos(theta) * r, dy: Math.sin(theta) * r });
  }
  return out;
}

// State-machine flavored: treat “open deck” as a transition producing next state + transition payload.
export function openDeck(
  input: {
    deck: DeckRuntimeState;
    worldTasksProcessed: number;
    econ: EconomyState;
    rng: Rng;
    cfg?: BalanceConfig;
  }
): DeckOpenResult {
  const cfg = input.cfg ?? defaultBalance;

  const status = computeDeckStatus(cfg, input.deck.type, input.worldTasksProcessed);
  if (status === "locked") throw new Error("deck is locked");

  const cost = computeDeckCost(input.econ, input.deck.baseCost);
  const wasFree = input.deck.type === "first_day" && input.deck.timesOpened < cfg.firstDayFreeOpenLimit;

  if (!wasFree && input.econ.coin < cost) throw new Error("insufficient coins");

  const def = deckDefinitions[input.deck.type];
  const picks: Array<{ type: string }> = [];
  for (let i = 0; i < cfg.deckOpenDrawCount; i++) {
    picks.push({ type: pickWeighted(input.rng, def.contents).type });
  }

  const nextDeck: DeckRuntimeState = {
    ...input.deck,
    status,
    timesOpened: input.deck.timesOpened + 1
  };

  const transition: DeckOpenTransition = {
    kind: "deck_open",
    deck_id: input.deck.id,
    pattern: "clockwise_ring",
    card_count: cfg.deckOpenDrawCount,
    offsets: clockwiseRingOffsets(cfg.deckOpenDrawCount)
  };

  return {
    cost,
    was_free: wasFree,
    transition,
    picks,
    next: { deck: nextDeck }
  };
}


export type LootType = "coin" | "paper" | "ink" | "gear" | "parts" | "blueprint_shard";

export type LootInventory = Record<LootType, number>;

const LOOT_TYPES: LootType[] = ["coin", "paper", "ink", "gear", "parts", "blueprint_shard"];

let inventory: LootInventory = {
  coin: 0,
  paper: 0,
  ink: 0,
  gear: 0,
  parts: 0,
  blueprint_shard: 0,
};

export function getInventory(): LootInventory {
  return { ...inventory };
}

type PlayerStateResponse = {
  loot?: Partial<LootInventory>;
};

function applyLoot(loot?: Partial<LootInventory>) {
  const next = { ...inventory };
  for (const t of LOOT_TYPES) {
    next[t] = Number(loot?.[t] ?? 0);
  }
  inventory = next;
  updateInventoryUI();
}

async function fetchPlayerState(): Promise<PlayerStateResponse> {
  const res = await fetch("/api/player/state");
  if (!res.ok) {
    throw new Error(`GET /api/player/state failed: ${res.status}`);
  }
  return res.json();
}

export function updateInventoryUI(): void {
  for (const t of LOOT_TYPES) {
    const el = document.getElementById(`loot-${t}`);
    if (!el) continue;
    el.textContent = String(inventory[t] ?? 0);
  }
}

export async function refreshInventory(): Promise<void> {
  try {
    const s = await fetchPlayerState();
    applyLoot(s.loot);
  } catch (e) {
    console.warn("Failed to refresh inventory", e);
  }
}

export async function loadInventory(): Promise<void> {
  await refreshInventory();
}

// Check if a card is loot that can be collected
export function isCollectableLoot(defId: string): LootType | null {
  if (!defId.startsWith("loot.")) return null;
  const lootType = defId.slice("loot.".length) as LootType;
  if (LOOT_TYPES.includes(lootType)) return lootType;
  return null;
}

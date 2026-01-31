// Loot inventory management

export interface LootInventory {
  coin: number;
  wood: number;
}

let inventory: LootInventory = {
  coin: 0,
  wood: 0,
};

export function getInventory(): LootInventory {
  return { ...inventory };
}

export function addLoot(type: keyof LootInventory, amount: number = 1): void {
  inventory[type] += amount;
  updateInventoryUI();
  saveInventory();
}

export function removeLoot(type: keyof LootInventory, amount: number = 1): boolean {
  if (inventory[type] < amount) return false;
  inventory[type] -= amount;
  updateInventoryUI();
  saveInventory();
  return true;
}

export function updateInventoryUI(): void {
  const coinEl = document.getElementById("loot-coin");
  const woodEl = document.getElementById("loot-wood");

  if (coinEl) coinEl.textContent = String(inventory.coin);
  if (woodEl) woodEl.textContent = String(inventory.wood);
}

function saveInventory(): void {
  try {
    localStorage.setItem("donegeon-inventory", JSON.stringify(inventory));
  } catch (e) {
    console.warn("Failed to save inventory", e);
  }
}

export function loadInventory(): void {
  try {
    const saved = localStorage.getItem("donegeon-inventory");
    if (saved) {
      inventory = { ...inventory, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn("Failed to load inventory", e);
  }
  updateInventoryUI();
}

// Check if a card is loot that can be collected
export function isCollectableLoot(defId: string): keyof LootInventory | null {
  if (defId === "loot.coin") return "coin";
  if (defId === "loot.wood") return "wood";
  return null;
}

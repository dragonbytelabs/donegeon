import type { CardKind, Card, Stack } from "./types";
import { uid, snapToGrid } from "./geometry";
import { stacks } from "./state";

export function make(kind: CardKind, title: string, icon: string, leftBadge?: string, rightBadge?: string): Card {
  return { id: uid("c"), kind, title, icon, leftBadge, rightBadge };
}

export function spawn(kind: "coin" | "wood" | "berry" | "villager") {
  let card: Card;

  switch (kind) {
    case "coin": card = make("sl-kind-coin", "Coin", "🪙", "1", ""); break;
    case "wood": card = make("sl-kind-wood", "Wood", "🪵", "1", ""); break;
    case "berry": card = make("sl-kind-food", "Berry", "🍓", "8", "1"); break;
    case "villager": card = make("sl-kind-blank", "Villager", "🧩", "", ""); break;
  }

  const id = uid("stack");
  const start = snapToGrid(320, 120);
  stacks.set(id, { id, x: start.x, y: start.y, cards: [card] });
}

export function initShell() {
  const toggle = document.getElementById("sidebarToggle");
  const sidebar = document.getElementById("sidebar");
  const shell = document.getElementById("appShell");

  toggle?.addEventListener("click", () => {
    if (!sidebar || !shell) return;
    const hidden = sidebar.classList.toggle("hidden");
    shell.className = hidden ? "grid h-full w-full grid-cols-[1fr]" : "grid h-full w-full grid-cols-[260px_1fr]";
  });

  document.querySelectorAll("button[data-spawn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const k = (btn as HTMLElement).dataset.spawn as any;
      spawn(k);
    });
  });
}

export function seed() {
  stacks.set("stack_coin", { id: "stack_coin", x: 380, y: 220, cards: [make("sl-kind-coin", "Coin", "🪙", "1", "")] });
  stacks.set("stack_berries", { id: "stack_berries", x: 770, y: 180, cards: Array.from({ length: 6 }, () => make("sl-kind-food", "Berry", "🍓", "8", "1")) });
  stacks.set("stack_wood", { id: "stack_wood", x: 560, y: 210, cards: [make("sl-kind-wood", "Wood", "🪵", "1", ""), make("sl-kind-wood", "Wood", "🪵", "1", "")] });
}

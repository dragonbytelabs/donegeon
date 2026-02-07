import { CardEntity, uid } from "@donegeon/core";
import type { DonegeonCardDef, DonegeonCardKind } from "./types";

export const donegeonDefs = {
    // -------------------------
    // Decks (clickable)
    // -------------------------
    "deck.first_day": {
        id: "deck.first_day",
        kind: "deck",
        title: "First Day",
        icon: "📦",
        skin: "sl-kind-wood",
        leftBadge: "DECK",
    },
    "deck.first_day_pack": {
        id: "deck.first_day_pack",
        kind: "deck",
        title: "First Day Pack",
        icon: "🎁",
        skin: "sl-kind-wood",
        leftBadge: "OPEN",
    },
    "deck.organization": {
        id: "deck.organization",
        kind: "deck",
        title: "Organization",
        icon: "🔒",
        skin: "sl-kind-stone",
        leftBadge: "LOCK",
        rightBadge: "LVL 10",
    },
    "deck.survival": {
        id: "deck.survival",
        kind: "deck",
        title: "Survival",
        icon: "🔒",
        skin: "sl-kind-stone",
        leftBadge: "LOCK",
        rightBadge: "LVL 5",
    },
    "deck.collect": {
        id: "deck.collect",
        kind: "deck",
        title: "Collect",
        icon: "📥",
        skin: "sl-kind-coin",
        leftBadge: "DROP",
    },

    // -------------------------
    // Villagers
    // -------------------------
    "villager.basic": {
        id: "villager.basic",
        kind: "villager",
        title: "Villager 1",
        icon: "🧑‍🌾",
        skin: "sl-kind-blank",
        leftBadge: "VIL",
    },

    // -------------------------
    // Tasks (blank)
    // -------------------------
    "task.blank": {
        id: "task.blank",
        kind: "task",
        title: "Blank Task",
        icon: "📝",
        skin: "sl-kind-quest",
        leftBadge: "TASK",
    },
    "task.instance": {
        id: "task.instance",
        kind: "task",
        title: "Task",
        icon: "📝",
        skin: "sl-kind-quest",
        leftBadge: "TASK",
    },
    "blueprint.instance": {
        id: "blueprint.instance",
        kind: "blueprint",
        title: "Blueprint",
        icon: "📐",
        skin: "sl-kind-wood",
        leftBadge: "BP",
    },

    // -------------------------
    // Modifiers
    // -------------------------
    "mod.recurring": {
        id: "mod.recurring",
        kind: "modifier",
        title: "Recurring",
        icon: "🔁",
        skin: "sl-kind-food",
        leftBadge: "MOD",
    },
    "mod.recurring_contract": {
        id: "mod.recurring_contract",
        kind: "modifier",
        title: "Recurring Contract",
        icon: "🧾",
        skin: "sl-kind-food",
        leftBadge: "MOD",
    },
    "mod.deadline_pin": {
        id: "mod.deadline_pin",
        kind: "modifier",
        title: "Deadline Pin",
        icon: "🎯",
        skin: "sl-kind-stone",
        leftBadge: "MOD",
    },
    "mod.next_action": {
        id: "mod.next_action",
        kind: "modifier",
        title: "Next Action",
        icon: "⚠️",
        skin: "sl-kind-quest",
        leftBadge: "MOD",
    },
    "mod.context_filter": {
        id: "mod.context_filter",
        kind: "modifier",
        title: "Context Filter",
        icon: "🏷️",
        skin: "sl-kind-stone",
        leftBadge: "MOD",
    },
    "mod.importance_seal": {
        id: "mod.importance_seal",
        kind: "modifier",
        title: "Importance Seal",
        icon: "📌",
        skin: "sl-kind-coin",
        leftBadge: "MOD",
    },
    "mod.schedule_token": {
        id: "mod.schedule_token",
        kind: "modifier",
        title: "Schedule Token",
        icon: "🗓️",
        skin: "sl-kind-wood",
        leftBadge: "MOD",
    },

    // -------------------------
    // Resources
    // -------------------------
    "resource.berry_bush": {
        id: "resource.berry_bush",
        kind: "resource",
        title: "Berry Bush",
        icon: "🫐",
        skin: "sl-kind-food",
        leftBadge: "RES",
    },
    "resource.mushroom_patch": {
        id: "resource.mushroom_patch",
        kind: "resource",
        title: "Mushroom Patch",
        icon: "🍄",
        skin: "sl-kind-food",
        leftBadge: "RES",
    },
    "resource.scrap_pile": {
        id: "resource.scrap_pile",
        kind: "resource",
        title: "Scrap Pile",
        icon: "🧱",
        skin: "sl-kind-stone",
        leftBadge: "RES",
    },

    // -------------------------
    // Food
    // -------------------------
    "food.berries": {
        id: "food.berries",
        kind: "food",
        title: "Berries",
        icon: "🫐",
        skin: "sl-kind-food",
        leftBadge: "FOOD",
    },
    "food.mushroom": {
        id: "food.mushroom",
        kind: "food",
        title: "Mushroom",
        icon: "🍄",
        skin: "sl-kind-food",
        leftBadge: "FOOD",
    },
    "food.bread": {
        id: "food.bread",
        kind: "food",
        title: "Bread",
        icon: "🍞",
        skin: "sl-kind-food",
        leftBadge: "FOOD",
    },

    // -------------------------
    // Zombies
    // -------------------------
    "zombie.default_zombie": {
        id: "zombie.default_zombie",
        kind: "zombie",
        title: "Zombie",
        icon: "🧟",
        skin: "sl-kind-quest",
        leftBadge: "FOE",
    },

    // -------------------------
    // Loot
    // -------------------------
    "loot.coin": {
        id: "loot.coin",
        kind: "loot",
        title: "Coin",
        icon: "🪙",
        skin: "sl-kind-coin",
        leftBadge: "+1",
    },
    "loot.paper": {
        id: "loot.paper",
        kind: "loot",
        title: "Paper",
        icon: "📄",
        skin: "sl-kind-blank",
        leftBadge: "+1",
    },
    "loot.ink": {
        id: "loot.ink",
        kind: "loot",
        title: "Ink",
        icon: "🖋️",
        skin: "sl-kind-stone",
        leftBadge: "+1",
    },
    "loot.gear": {
        id: "loot.gear",
        kind: "loot",
        title: "Gear",
        icon: "⚙️",
        skin: "sl-kind-stone",
        leftBadge: "+1",
    },
    "loot.parts": {
        id: "loot.parts",
        kind: "loot",
        title: "Parts",
        icon: "🔩",
        skin: "sl-kind-wood",
        leftBadge: "+1",
    },
    "loot.blueprint_shard": {
        id: "loot.blueprint_shard",
        kind: "loot",
        title: "Blueprint Shard",
        icon: "🧩",
        skin: "sl-kind-wood",
        leftBadge: "+1",
    },
} satisfies Record<string, DonegeonCardDef>;

export type DonegeonDefId = keyof typeof donegeonDefs;

function asText(v: unknown): string {
    return typeof v === "string" ? v.trim() : "";
}

function dynamicPluginDef(defId: string, data: Record<string, unknown> = {}): DonegeonCardDef {
    const title = asText(data.title) || asText(data.pluginName) || "Plugin Card";
    const icon = asText(data.icon) || "🔌";
    return {
        id: defId,
        kind: "modifier",
        title,
        icon,
        skin: "sl-kind-stone",
        leftBadge: "PLUG",
    };
}

export function resolveCardDef(defId: string, data: Record<string, unknown> = {}): DonegeonCardDef {
    const known = donegeonDefs[defId as DonegeonDefId];
    if (known) return known;
    if (defId.startsWith("mod.plugin_") || defId.startsWith("plugin.")) {
        return dynamicPluginDef(defId, data);
    }
    return donegeonDefs["task.blank"];
}

export function spawn(defId: DonegeonDefId, data: Record<string, unknown> = {}) {
    const def = donegeonDefs[defId];
    if (!def) throw new Error(`Unknown card def: ${defId}`);
    return new CardEntity(uid("card"), def, data);
}

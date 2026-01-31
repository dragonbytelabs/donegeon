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
    "loot.wood": {
        id: "loot.wood",
        kind: "loot",
        title: "Wood",
        icon: "🪵",
        skin: "sl-kind-wood",
        leftBadge: "+1",
    },
} satisfies Record<string, DonegeonCardDef>;

export type DonegeonDefId = keyof typeof donegeonDefs;

export function spawn(defId: DonegeonDefId, data: Record<string, unknown> = {}) {
    const def = donegeonDefs[defId];
    if (!def) throw new Error(`Unknown card def: ${defId}`);
    return new CardEntity(uid("card"), def, data);
}

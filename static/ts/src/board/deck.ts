import { snapToGrid } from "../../../../frontend/packages/core";
import { spawn, type DonegeonDefId } from "../model/catalog";
import type { DeckPoolEntry, DeckConfig, DonegeonConfig, OpenDeckOpts } from "../model/types";
import { raf, mulberry32, pickWeightedIndex } from "./utils";

function findDeck(cfg: DonegeonConfig, deckId: string): DeckConfig | null {
    const list = cfg.decks?.list ?? [];
    return list.find((d) => d.id === deckId) ?? null;
}
async function openPackFromDeck(opts: OpenDeckOpts) {
    const { cfg, engine, deckStackId, deckIdForDraws } = opts;
    const s = engine.getStack(deckStackId);
    if (!s) return;

    // guard against double-open
    const top = s.topCard();
    if (!top || top.def.id !== "deck.first_day_pack") return;

    const deckCfg = findDeck(cfg, deckIdForDraws);
    if (!deckCfg) {
        console.error("[donegeon] deck not found in cfg:", deckIdForDraws, cfg.decks?.list);
        return;
    }

    const origin = s.pos[0]();
    const rng = mulberry32(opts.seed);
    const N = deckCfg.draws.count;
    const radius = opts.radius ?? 170;

    for (let i = 0; i < N; i++) {
        const a = (-Math.PI / 2) + (i / N) * (Math.PI * 2);
        const x = origin.x + Math.cos(a) * radius;
        const y = origin.y + Math.sin(a) * (radius * 0.72);

        try {
            const drawn = drawFromDeck(cfg, deckIdForDraws, rng);
            engine.createStack(snapToGrid(x, y), [spawn(drawn.defId, drawn.data ?? {})]);
            await raf();
        } catch (err) {
            console.error(`[donegeon] draw failed: ${deckIdForDraws}:`, err);
        }
    }

    engine.removeStack(deckStackId);
}

/**
 * Convert YAML pool entry -> your existing donegeonDefs id
 * IMPORTANT: this assumes your YAML uses ids that match your defs:
 *  - modifier_id: "recurring" -> "mod.recurring"
 *  - loot_id: "coin" -> "loot.coin"
 */
function entryToDefId(e: DeckPoolEntry): { defId: DonegeonDefId; data?: Record<string, unknown> } | null {
    switch (e.card_type) {
        case "blank":
            return { defId: "task.blank" };

        case "villager":
            // if you want names/etc later, stash in data:
            return { defId: "villager.basic", data: e.villager_id ? { villager_id: e.villager_id } : {} };

        case "modifier":
            if (!e.modifier_id) return null;
            return { defId: (`mod.${e.modifier_id}` as DonegeonDefId) };

        case "loot":
            if (!e.loot_id) return null;
            return { defId: (`loot.${e.loot_id}` as DonegeonDefId), data: e.amount ? { amount: e.amount } : {} };

        case "resource":
            if (!e.resource_id) return null;
            return { defId: (`resource.${e.resource_id}` as DonegeonDefId) };

        case "food":
            if (!e.food_id) return null;
            return { defId: (`food.${e.food_id}` as DonegeonDefId), data: e.amount ? { amount: e.amount } : {} };
    }
}

function drawFromDeck(cfg: DonegeonConfig, deckId: string, rng: () => number) {
    const deck = findDeck(cfg, deckId);

    if (!deck) {
        console.error("[donegeon] missing deck in config: ", deckId);
        throw new Error(`Missing deck in config: ${deckId}`);
    }

    const pool = deck.draws.rng_pool;
    if (!pool.length) throw new Error(`Deck has empty rng_pool: ${deckId}`);

    const weights = pool.map((x) => x.weight);
    for (let tries = 0; tries < 50; tries++) {
        const idx = pickWeightedIndex(rng, weights);
        const pick = pool[idx];
        const mapped = entryToDefId(pick);
        console.log({
            idx,
            pick,
            mapped
        })
        if (mapped) return mapped;
    }

    throw new Error(`Deck pool entries don't map to defs (deck=${deckId}). Check YAML ids.`);
}

export {
openPackFromDeck
} 
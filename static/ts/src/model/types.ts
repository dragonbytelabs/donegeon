import { Engine } from "../../../../frontend/packages/core";

type DeckPoolEntry = {
    card_type: "blank" | "villager" | "modifier" | "loot" | "resource" | "food";
    villager_id?: string;
    modifier_id?: string;
    loot_id?: string;
    resource_id?: string;
    food_id?: string;
    amount?: number;
    weight: number;
};

type DeckConfig = {
    id: string;
    draws: { count: number; rng_pool: DeckPoolEntry[] };
};

type DonegeonConfig = {
    seeded_rng?: { enabled?: boolean; deterministic_deck_draws?: boolean };
    decks?: { list?: DeckConfig[] };
};

type OpenDeckOpts = {
    cfg: DonegeonConfig;
    engine: Engine;
    deckStackId: string;
    deckIdForDraws: string; // e.g. "deck.first_day"
    seed: number;
    radius?: number;
}



export type { DeckPoolEntry, DeckConfig, DonegeonConfig, OpenDeckOpts };
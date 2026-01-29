import { Engine } from "@donegeon/core";

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

type RecurrenceDTO = {
    type: "daily" | "weekly" | "monthly";
    interval: number;
};

type TaskDTO = {
    id: string;
    title: string;
    description: string;
    done: boolean;
    project?: string;
    tags: string[];
    modifiers: string[];
    dueDate?: string;
    nextAction: boolean;
    recurrence?: RecurrenceDTO;
};

type ModifierSchema = {
  showDueDate: boolean;
  showNextAction: boolean;
  showRecurrence: boolean;
};

type ModalRefs = {
  overlay: HTMLDivElement;
  panel: HTMLDivElement;
  title: HTMLInputElement;
  desc: HTMLTextAreaElement;
  done: HTMLInputElement;
  project: HTMLInputElement;
  tags: HTMLInputElement;
  err: HTMLDivElement;
  mods: HTMLDivElement;

  dueSection: HTMLElement;
  dueDate: HTMLInputElement;

  nextSection: HTMLElement;
  nextAction: HTMLInputElement;

  recSection: HTMLElement;
  recType: HTMLSelectElement;
  recInv: HTMLInputElement;

  btnClose: HTMLButtonElement;
  btnSave: HTMLButtonElement;
};

export type { DeckPoolEntry, DeckConfig, DonegeonConfig, OpenDeckOpts, TaskDTO, RecurrenceDTO, ModifierSchema, ModalRefs };
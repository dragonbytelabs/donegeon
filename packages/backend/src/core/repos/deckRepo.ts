import type { DeckModel, DeckType } from '../types.js';

export type DeckDefinitionEntry = { type: string; weight: number };
export type DeckDefinition = { contents: DeckDefinitionEntry[] };

export const deckDefinitions: Record<DeckType, DeckDefinition> = {
  first_day: {
    contents: [
      { type: 'blank_task', weight: 30 },
      { type: 'loot:coin', weight: 25 },
      { type: 'loot:paper', weight: 15 },
      { type: 'resource:berry_bush', weight: 15 },
      { type: 'modifier:next_action', weight: 10 },
      { type: 'modifier:checklist', weight: 5 }
    ]
  },
  organization: {
    contents: [
      { type: 'modifier:next_action', weight: 25 },
      { type: 'modifier:review_cadence', weight: 25 },
      { type: 'modifier:checklist', weight: 20 },
      { type: 'modifier:recurring_contract', weight: 15 },
      { type: 'modifier:importance_seal', weight: 10 },
      { type: 'blank_task', weight: 5 }
    ]
  },
  maintenance: {
    contents: [
      { type: 'modifier:recurring_contract', weight: 30 },
      { type: 'modifier:waiting_on', weight: 25 },
      { type: 'modifier:review_cadence', weight: 20 },
      { type: 'modifier:deadline_pin', weight: 15 },
      { type: 'loot:gear', weight: 5 },
      { type: 'blank_task', weight: 5 }
    ]
  },
  planning: {
    contents: [
      { type: 'modifier:next_action', weight: 30 },
      { type: 'modifier:checklist', weight: 25 },
      { type: 'modifier:schedule_token', weight: 20 },
      { type: 'loot:blueprint_shard', weight: 15 },
      { type: 'loot:paper', weight: 10 }
    ]
  },
  integration: {
    contents: [
      { type: 'loot:parts', weight: 45 },
      { type: 'loot:blueprint_shard', weight: 35 },
      { type: 'loot:gear', weight: 20 }
    ]
  }
};

export class DeckRepo {
  private byId = new Map<string, DeckModel>();

  seed(ds: DeckModel[]) {
    for (const d of ds) this.byId.set(d.id, d);
  }

  list(): DeckModel[] {
    return [...this.byId.values()];
  }

  get(id: string): DeckModel | undefined {
    return this.byId.get(id);
  }

  update(d: DeckModel): DeckModel {
    this.byId.set(d.id, d);
    return d;
  }
}


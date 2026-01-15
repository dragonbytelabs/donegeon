import type { DeckId } from './ids.js';

export type DeckStatus = 'locked' | 'unlocked';

export type DeckType =
  | 'first_day'
  | 'organization'
  | 'maintenance'
  | 'planning'
  | 'integration';

export interface Deck {
  id: DeckId;
  type: DeckType;
  name: string;
  description: string;

  status: DeckStatus;
  baseCost: number;
  timesOpened: number;

  // Unlock/progression metadata for UI display (backend-owned).
  unlockRequiredTasks?: number;
  worldTasksProcessed?: number;
}


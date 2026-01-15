import type { QuestId } from './ids.js';

export type QuestType = 'daily' | 'story' | 'seasonal' | 'boss' | 'failure';
export type QuestStatus = 'active' | 'complete' | 'failed' | 'locked';

export interface Quest {
  id: QuestId;
  title: string;
  description?: string;
  type: QuestType;
  status: QuestStatus;
}


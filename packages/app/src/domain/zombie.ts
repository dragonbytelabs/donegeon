import type { TaskId, ZombieId } from './ids.js';

export type ZombieReason = 'deadline_missed' | 'important_ignored' | 'recurring_no_charges' | 'inbox_neglect';

export interface Zombie {
  id: ZombieId;
  taskId: TaskId;
  reason: ZombieReason;
  spawnedAtIso: string;
}


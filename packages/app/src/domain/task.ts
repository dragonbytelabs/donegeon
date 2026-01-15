import type { TaskId } from './ids.js';
import type { TaskZone } from './zones.js';

// Core task model used by Donegeon (not Todoist API Task).
export interface Task {
  id: TaskId;
  name: string;
  description?: string;

  zone: TaskZone;
  completed: boolean;

  // Task-manager concepts expressed as game metadata.
  tags: string[];
  priority: 0 | 1 | 2 | 3 | 4;

  // Simulation hooks (backend-owned); frontend renders only.
  workTimeSeconds?: number;
  assignedVillagerId?: string;

  // Used for “blank task card” UX.
  isBlank?: boolean;
}


import type { VillagerId } from './ids.js';

export interface Villager {
  id: VillagerId;
  name: string;

  stamina: number;
  maxStamina: number;

  speedSecondsPerWorkUnit?: number;
  level?: number;
  tired?: boolean;
}


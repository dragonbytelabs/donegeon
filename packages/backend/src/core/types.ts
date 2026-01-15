export type TaskZone = 'inbox' | 'live' | 'completed' | 'archived';

export type TaskPriority = 0 | 1 | 2 | 3 | 4;

export interface TaskModel {
  id: number;
  name: string;
  description: string;
  zone: TaskZone;
  completed: boolean;

  tags: string[];
  priority: TaskPriority;

  // Work simulation
  work_started_at?: string; // ISO
  work_progress: number; // 0..1
  work_time_hours: number; // how many hours needed to complete at baseline

  assigned_villager?: string;
  worked_today: boolean;

  modifier_ids: string[];
  project_id: number | null;
}

export interface VillagerModel {
  id: string;
  name: string;
  stamina: number;
  max_stamina: number;
  speed: number; // multiplier: higher = faster
  level: number;
  tired: boolean;
}

export type ZombieReason = 'deadline_missed' | 'important_ignored' | 'recurring_no_charges' | 'inbox_neglect';

export interface ZombieModel {
  id: string;
  task_id: number;
  reason: ZombieReason;
  spawned_at: string; // ISO
}

export interface WorldModel {
  day_index: number;
  tasks_processed: number;
  overrun_level: number;
  loot_penalty_pct: number;
  pack_cost_pct: number;
}

export type ModifierStatus = 'active' | 'spent';
export type ModifierType =
  | 'recurring_contract'
  | 'deadline_pin'
  | 'schedule_token'
  | 'importance_seal'
  | 'waiting_on'
  | 'next_action'
  | 'review_cadence'
  | 'checklist';

export interface ModifierCardModel {
  id: string;
  type: ModifierType;
  created_at: string; // ISO
  status: ModifierStatus;

  max_charges: number; // 0 can mean infinite
  charges: number;

  // optional scheduling metadata
  deadline_at?: string; // ISO
  scheduled_at?: string; // ISO
  recurring_every_days?: number;
  recurring_next_at?: string; // ISO

  unblocked_at?: string; // waiting_on
  review_every_days?: number; // review_cadence
  review_next_at?: string; // review_cadence
  checklist_total?: number; // checklist
  checklist_completed?: number; // checklist
}

export type LootType = 'coin' | 'paper' | 'ink' | 'gear' | 'parts' | 'blueprint_shard';

export interface LootDropModel {
  type: LootType;
  amount: number;
}

export interface InventoryModel {
  coin: number;
  paper: number;
  ink: number;
  gear: number;
  parts: number;
  blueprint_shard: number;
}

export type DeckStatus = 'locked' | 'unlocked';
export type DeckType = 'first_day' | 'organization' | 'maintenance' | 'planning' | 'integration';

export interface DeckModel {
  id: string; // deck_first_day etc
  type: DeckType;
  name: string;
  description: string;
  status: DeckStatus;
  base_cost: number;
  times_opened: number;
}

export type QuestType = 'daily' | 'story' | 'seasonal' | 'boss' | 'failure';
export type QuestStatus = 'active' | 'complete' | 'failed' | 'locked';

export interface QuestReward {
  kind: string;
  [k: string]: unknown;
}

export interface QuestModel {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  status: QuestStatus;
  rewards: QuestReward[];
}

export interface RecipeModel {
  id: string;
  name: string;
  description: string;
}

export type BuildingStatus = 'available' | 'built';
export type BuildingType = 'rest_hall' | 'farm' | 'workshop' | 'library';

export interface BuildingModel {
  type: BuildingType;
  name: string;
  description: string;
  status: BuildingStatus;
}

export interface ProjectModel {
  id: number;
  name: string;
  description: string;
  archived: boolean;
}

export type CardZone = 'inbox' | 'live' | 'completed' | 'archived' | 'board';
export type CardType = 'task' | 'villager' | 'zombie' | 'loot' | 'modifier' | 'building' | 'resource' | 'food';

export interface CardModel {
  id: string;
  type: CardType;
  zone: CardZone;
  data: unknown;
}

export interface EngineConfig {
  max_zombies_per_day: number;
  deck_unlock_organization_tasks: number;
  deck_unlock_maintenance_tasks: number;
  deck_unlock_planning_tasks: number;
  deck_unlock_integration_tasks: number;
}


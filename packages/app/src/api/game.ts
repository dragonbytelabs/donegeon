// API DTOs / contracts shared by frontend and backend.

export type LootInventoryDto = {
  coin: number;
  paper: number;
  ink: number;
  gear: number;
  parts: number;
  blueprint_shard: number;
};

export type VillagerDto = {
  id: string;
  name: string;
  stamina: number;
  max_stamina: number;
  speed: number;
  level: number;
  tired: boolean;
};

export type TaskDto = {
  id: number;
  name: string;
  description: string;
  zone: "inbox" | "live" | "completed";
  completed: boolean;
  tags: string[];
  priority: number;
  work_progress: number;
  work_time_hours: number;
  worked_today: boolean;
  modifier_ids: string[];
  project_id: number | null;
  work_started_at?: string;
};

export type ZombieDto = {
  id: string;
  task_id: number;
  reason: string;
  spawned_at: string;
};

export type DeckDto = {
  id: string;
  type: string;
  name: string;
  description: string;
  status: "locked" | "unlocked";
  base_cost: number;
  times_opened: number;
  unlock_required_tasks?: number;
  world_tasks_processed?: number;
};

export type TodaySummaryDto = {
  danger_level: string;
  villagers_free: number;
  villagers_total: number;
  tasks_live: number;
  tasks_completed_today: number;
  zombies_active: number;
};

export type DeckOpenResultDto = {
  drops: any[];
  cost: number;
  was_free: boolean;
};


export type DeckOpenTransitionDto = {
  kind: "deck_open";
  deck_id: string;
  pattern: "clockwise_ring";
  card_count: number;
  offsets: Array<{ order: number; dx: number; dy: number }>;
};

// v0.3 Board persistence DTOs
export type BoardEntityDto =
  | { id: string; kind: "deck"; deck_id: string; x: number; y: number; stack_id?: string }
  | {
      id: string;
      kind: "card";
      card_type: "task" | "villager" | "modifier" | "loot" | "resource" | "food";
      subtype?: string;
      x: number;
      y: number;
      stack_id?: string;
      payload?: any;
    };

export type StackDto = {
  id: string;
  task_id?: string;
  attached_ids: string[];
};

export type BoardStateDto = {
  grid_size: number;
  entities: BoardEntityDto[];
  stacks: StackDto[];
};

export type BoardEventDto =
  | { kind: "wiggle"; entity_id: string; to: { x: number; y: number } }
  | { kind: "stacked"; stack_id: string; entity_ids: string[] }
  | { kind: "unstacked"; stack_id: string; entity_ids: string[] }
  | { kind: "collected"; entity_id: string }
  | { kind: "consumed"; entity_id: string }
  | { kind: "sold"; entity_id: string; loot_type: string; loot_amount: number }
  | { kind: "deck_open_fanout"; deck_entity_id: string; card_entity_ids: string[]; transition: DeckOpenTransitionDto };

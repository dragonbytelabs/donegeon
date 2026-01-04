export type TaskZone = "inbox" | "live";

export type Task = {
  id: number;
  name: string;
  description: string;
  zone: TaskZone;
  completed: boolean;
  tags: string[];
  modifier_ids: string[];
  live_at?: string | null;
};

export type ModifierType =
  | "recurring_contract"
  | "deadline_pin"
  | "schedule_token"
  | "importance_seal";

export type ModifierStatus = "active" | "spent";

export type ModifierCard = {
  id: string;
  type: ModifierType;
  created_at: string;

  max_charges: number;
  charges: number;

  status: ModifierStatus;

  deadline_at?: string | null;
  scheduled_at?: string | null;
  recurring_every_days?: number | null;
  recurring_next_at?: string | null;
};

export type Quest = {
  id: string;
  title: string;
  description: string;
  status: string;
};

export type Recipe = {
  id: string;
  title: string;
  description: string;
  status?: string;
};

export type Villager = {
  id: string;
  name: string;
  stamina_per_day: number;
  slots_remaining: number;
  blocked_by_zombie: boolean;
};

export type Zombie = {
  id: string;
  task_id: number;
  reason: string;
  spawned_at: string;
};

export type World = {
  day: string;
  loot_penalty_pct: number;
  pack_cost_pct: number;
  overrun: boolean;
};

export type DayTickResult = {
  day: string;
  zombies_spawned: number;
  zombies_total: number;
  villagers_blocked: number;
  slots_available: number;
  loot_penalty_pct: number;
  pack_cost_pct: number;
  overrun: boolean;
};

export type ClearZombieResult = {
  zombie_id: string;
  used_villager: string;
  slots_spent: number;
  zombies_total: number;
  villagers_blocked: number;
  slots_available: number;
  slots_remaining: number;
};

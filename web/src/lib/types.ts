export type TaskZone = "inbox" | "live" | "completed" | "archived";

export type Task = {
  id: number;
  name: string;
  description: string;
  zone: TaskZone;
  completed: boolean;
  order: number;
  tags: string[];
  modifier_ids: string[];
  live_at?: string | null;
  assigned_villager?: string | null;
  project_id?: number | null;
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

export type ResourceCard = {
  resource_type: string;
  charges: number;
  max_charges: number;
  gather_time: number; // seconds to gather one unit
  produces: string; // food_type produced
  stamina_restore: number; // stamina restored by food
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
  max_stamina: number;
  stamina: number;
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

export type TodaySummary = {
  day: string;
  villagers_free: number;
  villagers_blocked: number;
  villagers_total: number;
  slots_available: number;
  tasks_live: number;
  tasks_completed_today: number;
  zombies_active: number;
  danger_level: "safe" | "warning" | "danger" | "overrun";
  loot_penalty_pct: number;
  pack_cost_pct: number;
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

export type LootType =
  | "coin"
  | "paper"
  | "ink"
  | "gear"
  | "parts"
  | "blueprint_shard";

export type LootDrop = {
  type: LootType;
  amount: number;
};

export type Inventory = {
  coin: number;
  paper: number;
  ink: number;
  gear: number;
  parts: number;
  blueprint_shard: number;
};

export type CompleteTaskResult = {
  task: Task;
  loot_drops: LootDrop[];
};

export type DeckType =
  | "first_day"
  | "organization"
  | "maintenance"
  | "planning"
  | "integration";

export type DeckStatus = "locked" | "unlocked";

export type Deck = {
  id: string;
  type: DeckType;
  name: string;
  description: string;
  status: DeckStatus;
  base_cost: number;
  times_opened: number;
};

export type CardDrop = {
  type: string; // "blank_task", "villager", "modifier", "loot"
  modifier_type?: string;
  modifier_card?: ModifierCard;
  loot_type?: string;
  loot_amount?: number;
  villager_id?: string;
  resource_card?: ResourceCard;
};

export type OpenDeckResult = {
  deck_id: string;
  drops: CardDrop[];
  cost_paid: number;
};

export type BuildingType =
  | "project_board"
  | "rest_hall"
  | "calendar_console"
  | "routine_farm"
  | "automation_forge";

export type BuildingStatus = "locked" | "built";

export type Building = {
  id: string;
  type: BuildingType;
  name: string;
  description: string;
  effect: string;
  status: BuildingStatus;
};

export type Project = {
  id: number;
  name: string;
  description: string;
  color?: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

import type { Clock } from './clock.js';
import type { BuildingRepo } from './repos/buildingRepo.js';
import type { CardRepo } from './repos/cardRepo.js';
import type { DeckRepo } from './repos/deckRepo.js';
import { deckDefinitions } from './repos/deckRepo.js';
import type { LootRepo } from './repos/lootRepo.js';
import type { ModifierRepo } from './repos/modifierRepo.js';
import type { ProjectRepo } from './repos/projectRepo.js';
import type { QuestRepo } from './repos/questRepo.js';
import type { RecipeRepo } from './repos/recipeRepo.js';
import type { TaskRepo } from './repos/taskRepo.js';
import type { VillagerRepo } from './repos/villagerRepo.js';
import type { WorldRepo } from './repos/worldRepo.js';
import type { ZombieRepo } from './repos/zombieRepo.js';
import type {
  BuildingType,
  CardModel,
  DeckType,
  EngineConfig,
  LootDropModel,
  LootType,
  ModifierCardModel,
  ModifierType,
  ZombieModel,
  ZombieReason
} from './types.js';
import type { Rng } from './rng.js';
import type { DeckOpenTransitionDto } from '@donegeon/app/api';
import { defaultBalance, openDeck as openDeckRule } from '@donegeon/app/rules';

function pickWeighted<T extends { weight: number }>(rng: Rng, items: T[]): T {
  const total = items.reduce((acc, it) => acc + it.weight, 0);
  const r = rng.next() * total;
  let cur = 0;
  for (const it of items) {
    cur += it.weight;
    if (r <= cur) return it;
  }
  return items[items.length - 1];
}

function lootDrop(type: LootType, amount: number): LootDropModel {
  return { type, amount };
}

export class Engine {
  readonly config: EngineConfig;
  private idCounter = 1;

  constructor(
    private clock: Clock,
    private rng: Rng,
    private taskRepo: TaskRepo,
    private questRepo: QuestRepo,
    private recipeRepo: RecipeRepo,
    private villagerRepo: VillagerRepo,
    private zombieRepo: ZombieRepo,
    private worldRepo: WorldRepo,
    private modifierRepo: ModifierRepo,
    private lootRepo: LootRepo,
    private deckRepo: DeckRepo,
    private buildingRepo: BuildingRepo,
    private projectRepo: ProjectRepo,
    private cardRepo: CardRepo
  ) {
    this.config = {
      max_zombies_per_day: 5,
      deck_unlock_organization_tasks: 10,
      deck_unlock_maintenance_tasks: 25,
      deck_unlock_planning_tasks: 50,
      deck_unlock_integration_tasks: 100
    };
  }

  trackTaskProcessed() {
    const w = this.worldRepo.get();
    w.tasks_processed += 1;
    this.worldRepo.update(w);
  }

  completeTask(taskId: number) {
    const t = this.taskRepo.get(taskId);
    if (!t) throw new Error('task not found');
    t.completed = true;
    t.zone = 'completed';
    t.work_progress = 1;
    this.taskRepo.update(t);

    const drops: LootDropModel[] = [];
    // Minimal loot rules: coins + occasional paper/ink.
    drops.push(lootDrop('coin', 1));
    if (t.tags.includes('deep_work')) drops.push(lootDrop('blueprint_shard', 1));
    if (t.tags.includes('planning')) drops.push(lootDrop('paper', 1));
    if (t.tags.includes('admin')) drops.push(lootDrop('ink', 1));

    // Apply zombie penalty (very rough).
    const w = this.worldRepo.get();
    const penalty = Math.max(0, Math.min(1, w.loot_penalty_pct / 100));
    const finalDrops = penalty > 0 ? drops.map((d) => ({ ...d, amount: Math.max(0, Math.floor(d.amount * (1 - penalty))) })) : drops;
    this.lootRepo.add(finalDrops);

    // Mark modifier charges usage/spent on completion.
    for (const mid of t.modifier_ids) {
      const m = this.modifierRepo.get(mid);
      if (!m) continue;
      if (m.max_charges > 0) {
        m.charges = Math.max(0, m.charges - 1);
        if (m.charges === 0) m.status = 'spent';
        this.modifierRepo.update(m);
      }
    }

    return { status: 'completed', task: t, loot_drops: finalDrops };
  }

  dayTick() {
    const now = this.clock.now().toISOString();
    const w = this.worldRepo.get();
    w.day_index += 1;

    // Reset villager stamina.
    for (const v of this.villagerRepo.list()) {
      v.stamina = v.max_stamina;
      v.tired = false;
      this.villagerRepo.update(v);
    }

    // Clear task "worked today".
    for (const t of this.taskRepo.list()) {
      t.worked_today = false;
      this.taskRepo.update(t);
    }

    // Spawn zombies from inbox neglect (simple).
    const zombiesToday: ZombieModel[] = [];
    const inbox = this.taskRepo.listByZone('inbox');
    const cap = this.config.max_zombies_per_day;
    for (const t of inbox.slice(0, cap)) {
      const z: ZombieModel = {
        id: `z_${t.id}_${this.idCounter++}`,
        task_id: t.id,
        reason: 'inbox_neglect',
        spawned_at: now
      };
      this.zombieRepo.add(z);
      zombiesToday.push(z);
    }

    // Update penalties based on zombies.
    const zcount = this.zombieRepo.list().length;
    w.loot_penalty_pct = Math.min(80, zcount * 10);
    w.pack_cost_pct = Math.min(300, zcount * 25);
    this.worldRepo.update(w);

    return { day_index: w.day_index, zombies_spawned: zombiesToday.length, world: w };
  }

  clearZombie(zombieId: string, slots: number) {
    const z = this.zombieRepo.get(zombieId);
    if (!z) throw new Error('zombie not found');
    if (slots <= 0) throw new Error('slots must be > 0');
    // In Go, villager stamina/time is consumed; here we just remove and return status.
    this.zombieRepo.remove(zombieId);
    return { status: 'cleared', zombie_id: zombieId };
  }

  listCards() {
    return this.cardRepo.list();
  }

  listCardsByZone(zone: string) {
    return this.cardRepo.listByZone(zone as any);
  }

  todaySummary() {
    const tasks = this.taskRepo.list();
    const villagers = this.villagerRepo.list();
    const zombies = this.zombieRepo.list();

    const live = tasks.filter((t) => t.zone === 'live').length;
    const completedToday = tasks.filter((t) => t.zone === 'completed').length;
    const free = villagers.filter((v) => v.stamina > 0).length;

    const danger_level =
      zombies.length === 0 ? 'safe' : zombies.length <= 2 ? 'warning' : zombies.length <= 5 ? 'danger' : 'doom';

    return {
      danger_level,
      villagers_free: free,
      villagers_total: villagers.length,
      tasks_live: live,
      tasks_completed_today: completedToday,
      zombies_active: zombies.length
    };
  }

  openDeck(id: string) {
    const d = this.deckRepo.get(id);
    if (!d) throw new Error('deck not found');

    const w = this.worldRepo.get();
    const inv = this.lootRepo.get();

    // Delegate core rules to @donegeon/app (deterministic via injected RNG).
    const rule = openDeckRule({
      deck: {
        id: d.id,
        type: d.type as any,
        status: d.status as any,
        baseCost: d.base_cost,
        timesOpened: d.times_opened
      },
      worldTasksProcessed: w.tasks_processed,
      econ: { coin: inv.coin, packCostPct: w.pack_cost_pct },
      rng: this.rng,
      cfg: defaultBalance
    });

    // Apply cost
    if (!rule.was_free) {
      inv.coin -= rule.cost;
    }

    // Materialize picks into the existing backend drop shape + side effects.
    const drops: any[] = [];
    for (let i = 0; i < rule.picks.length; i++) {
      const pick = rule.picks[i]!;
      if (pick.type === 'blank_task') {
        drops.push({ type: 'blank_task' });
      } else if (pick.type.startsWith('loot:')) {
        const lt = pick.type.split(':')[1] as LootType;
        drops.push({ type: 'loot', loot_type: lt, loot_amount: 1 });
        this.lootRepo.addOne(lt, 1);
      } else if (pick.type.startsWith('modifier:')) {
        const mt = pick.type.split(':')[1] as ModifierType;
        const now = this.clock.now().toISOString();
        const card: ModifierCardModel = {
          id: `m_${this.idCounter++}_${i}`,
          type: mt,
          created_at: now,
          status: 'active',
          max_charges: mt === 'importance_seal' ? 3 : mt === 'schedule_token' ? 2 : mt === 'recurring_contract' ? 4 : 0,
          charges: mt === 'importance_seal' ? 3 : mt === 'schedule_token' ? 2 : mt === 'recurring_contract' ? 4 : 0
        };
        this.modifierRepo.create(card);
        drops.push({ type: 'modifier', modifier_card: card });
      } else if (pick.type.startsWith('resource:')) {
        const resource_type = pick.type.split(':')[1];
        drops.push({
          type: 'resource',
          resource_card: {
            resource_type,
            charges: 3,
            max_charges: 3,
            gather_time: 4,
            produces: 'berries',
            stamina_restore: 1
          }
        });
      }
    }

    // Persist updated coin + deck state
    this.lootRepo.update(inv);

    d.times_opened = rule.next.deck.timesOpened;
    d.status = rule.next.deck.status as any;
    this.deckRepo.update(d);

    // Apply unlocks to other decks based on tasks_processed
    this.applyDeckUnlocks();

    const transition: DeckOpenTransitionDto = rule.transition;
    return { drops, cost: rule.cost, was_free: rule.was_free, transition };
  }

  applyDeckUnlocks() {
    const w = this.worldRepo.get();
    for (const d of this.deckRepo.list()) {
      let req = 0;
      if (d.type === 'organization') req = this.config.deck_unlock_organization_tasks;
      if (d.type === 'maintenance') req = this.config.deck_unlock_maintenance_tasks;
      if (d.type === 'planning') req = this.config.deck_unlock_planning_tasks;
      if (d.type === 'integration') req = this.config.deck_unlock_integration_tasks;
      if (req === 0) continue;
      if (w.tasks_processed >= req) {
        d.status = 'unlocked';
        this.deckRepo.update(d);
      }
    }
  }

  attachModifier(taskId: number, card: ModifierCardModel) {
    const t = this.taskRepo.get(taskId);
    if (!t) throw new Error('task not found');
    // Upsert modifier in repo
    if (!this.modifierRepo.get(card.id)) this.modifierRepo.create(card);
    if (!t.modifier_ids.includes(card.id)) t.modifier_ids.push(card.id);
    this.taskRepo.update(t);
    return t;
  }

  detachModifier(taskId: number, modifierId: string) {
    const t = this.taskRepo.get(taskId);
    if (!t) throw new Error('task not found');
    t.modifier_ids = t.modifier_ids.filter((id) => id !== modifierId);
    this.taskRepo.update(t);
    return t;
  }

  craft(recipeId: string) {
    const r = this.recipeRepo.get(recipeId);
    if (!r) throw new Error('recipe not found');
    // Placeholder: crafting yields 1 coin.
    this.lootRepo.add([lootDrop('coin', 1)]);
    return { status: 'crafted', recipe_id: recipeId, drops: [lootDrop('coin', 1)] };
  }

  constructBuilding(type: BuildingType) {
    const b = this.buildingRepo.get(type);
    if (!b) throw new Error('building not found');
    if (b.status === 'built') return { status: 'already_built', building: b };
    b.status = 'built';
    this.buildingRepo.update(b);
    return { status: 'built', building: b };
  }

  getBalanceConfig() {
    return this.config;
  }
}


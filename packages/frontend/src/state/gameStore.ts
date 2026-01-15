import { createStore, produce } from "solid-js/store";
import { apiGet, apiPost } from "../lib/api";
import type {
  DeckDto,
  DeckOpenResultDto,
  DeckOpenTransitionDto,
  LootInventoryDto,
  TaskDto,
  TodaySummaryDto,
  VillagerDto,
  ZombieDto
} from "@donegeon/app/api";
import type { VersionResponse } from "@donegeon/app/api";

export type GameState = {
  version: VersionResponse | null;
  today: TodaySummaryDto | null;
  loot: LootInventoryDto | null;
  villagers: VillagerDto[];
  zombies: ZombieDto[];
  decks: DeckDto[];
  tasksInbox: TaskDto[];
  tasksLive: TaskDto[];
  tasksCompleted: TaskDto[];
  lastDeckOpen: DeckOpenResultDto | null;
  lastDeckOpenTransition: DeckOpenTransitionDto | null;

  loading: boolean;
  error: string | null;
};

export function createGameStore() {
  const [state, setState] = createStore<GameState>({
    version: null,
    today: null,
    loot: null,
    villagers: [],
    zombies: [],
    decks: [],
    tasksInbox: [],
    tasksLive: [],
    tasksCompleted: [],
    lastDeckOpen: null,
    lastDeckOpenTransition: null,
    loading: false,
    error: null
  });

  async function refreshAll() {
    setState(
      produce((s) => {
        s.loading = true;
        s.error = null;
      })
    );

    try {
      const [version, today, loot, villagers, zombies, decks, inbox, live, completed] = await Promise.all([
        apiGet<VersionResponse>("/api/version"),
        apiGet<TodaySummaryDto>("/api/today"),
        apiGet<LootInventoryDto>("/api/loot"),
        apiGet<VillagerDto[]>("/api/villagers"),
        apiGet<ZombieDto[]>("/api/zombies"),
        apiGet<DeckDto[]>("/api/decks"),
        apiGet<TaskDto[]>("/api/tasks/inbox"),
        apiGet<TaskDto[]>("/api/tasks/live"),
        apiGet<TaskDto[]>("/api/tasks/completed")
      ]);

      setState(
        produce((s) => {
          s.version = version;
          s.today = today;
          s.loot = loot;
          s.villagers = villagers;
          s.zombies = zombies;
          s.decks = decks;
          s.tasksInbox = inbox;
          s.tasksLive = live;
          s.tasksCompleted = completed;
          s.loading = false;
        })
      );
    } catch (e) {
      setState(
        produce((s) => {
          s.loading = false;
          s.error = e instanceof Error ? e.message : String(e);
        })
      );
    }
  }

  async function createTask(name: string, description: string, moveToLive: boolean) {
    const created = await apiPost<TaskDto>("/api/tasks", { name, description });
    if (moveToLive) {
      await apiPost<TaskDto>("/api/tasks/move-to-live", { id: created.id });
    }
    await refreshAll();
  }

  async function openFirstDayDeck() {
    const opened = await apiPost<{ drops: any[]; cost: number; was_free: boolean; transition: DeckOpenTransitionDto }>(
      "/api/decks/deck_first_day/open",
      {}
    );
    setState(
      produce((s) => {
        s.lastDeckOpen = { drops: opened.drops, cost: opened.cost, was_free: opened.was_free };
        s.lastDeckOpenTransition = opened.transition;
      })
    );
    await refreshAll();
  }

  async function assignAndWork(taskId: number, villagerId: string, hoursWorked: number) {
    await apiPost("/api/tasks/assign", { task_id: taskId, villager_id: villagerId });
    await apiPost("/api/tasks/process", { task_id: taskId, villager_id: villagerId, hours_worked: hoursWorked });
    await refreshAll();
  }

  async function dayTick() {
    await apiPost("/api/day/tick", {});
    await refreshAll();
  }

  async function clearZombie(zombieId: string, slots = 1) {
    await apiPost("/api/zombies/clear", { zombie_id: zombieId, slots });
    await refreshAll();
  }

  async function addModifier(taskId: number, type: string) {
    await apiPost("/api/tasks/modifiers/add", { task_id: taskId, type });
    await refreshAll();
  }

  return {
    state,
    actions: {
      refreshAll,
      createTask,
      openFirstDayDeck,
      assignAndWork,
      dayTick,
      clearZombie,
      addModifier
    }
  };
}


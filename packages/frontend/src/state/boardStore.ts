import { createStore, produce } from "solid-js/store";
import type { BoardEventDto, BoardStateDto, LootInventoryDto, TodaySummaryDto, VillagerDto } from "@donegeon/app/api";
import { apiGet, apiPost } from "../lib/api";
import {
  boardCollect,
  boardGetState,
  boardMove,
  boardOpenDeck,
  boardSell,
  boardSpawnDeck,
  boardStack,
  boardUnstack
} from "../lib/boardApi";
import { notificationsActions } from "./notificationsStore";

export type DeckMeta = {
  id: string;
  type: string;
  name: string;
  description: string;
  status: "locked" | "unlocked";
  base_cost: number;
  times_opened: number;
  unlock_required_tasks: number;
  world_tasks_processed: number;
};

export type CameraState = { panX: number; panY: number; zoom: number };

export type QuestMeta = {
  id: string;
  title: string;
  description?: string;
  type?: string;
  status?: string;
};

let questSnapshotInitialized = false;
const completedQuestIds = new Set<string>();

export type BoardUiState = {
  board: BoardStateDto | null;
  loot: LootInventoryDto | null;
  today: TodaySummaryDto | null;
  villagers: VillagerDto[];
  decks: DeckMeta[];
  questsActive: QuestMeta[];
  questsDaily: QuestMeta[];
  lastEvents: BoardEventDto[];

  camera: CameraState;

  loading: boolean;
  error: string | null;
  toast: string | null;
};

export function createBoardStore() {
  const [state, setState] = createStore<BoardUiState>({
    board: null,
    loot: null,
    today: null,
    villagers: [],
    decks: [],
    questsActive: [],
    questsDaily: [],
    lastEvents: [],
    camera: { panX: 0, panY: 0, zoom: 1 },
    loading: false,
    error: null,
    toast: null
  });

  function showToast(msg: string, ms = 2500) {
    setState(
      produce((s) => {
        s.toast = msg;
      })
    );
    setTimeout(() => {
      setState(
        produce((s) => {
          if (s.toast === msg) s.toast = null;
        })
      );
    }, ms);
  }

  async function load() {
    setState(
      produce((s) => {
        s.loading = true;
        s.error = null;
      })
    );
    try {
      const [board, loot, today, villagers, decks, questsActive, questsDaily, questsAll] = await Promise.all([
        boardGetState(),
        apiGet<LootInventoryDto>("/api/loot"),
        apiGet<TodaySummaryDto>("/api/today"),
        apiGet<VillagerDto[]>("/api/villagers"),
        apiGet<DeckMeta[]>("/api/decks"),
        apiGet<QuestMeta[]>("/api/quests/active"),
        apiGet<QuestMeta[]>("/api/quests/daily"),
        apiGet<QuestMeta[]>("/api/quests")
      ]);
      if (!questSnapshotInitialized) {
        for (const q of questsAll) {
          if (q.status === "complete") completedQuestIds.add(q.id);
        }
        questSnapshotInitialized = true;
      }
      setState(
        produce((s) => {
          s.board = board;
          s.loot = loot;
          s.today = today;
          s.villagers = villagers;
          s.decks = decks;
          s.questsActive = questsActive;
          s.questsDaily = questsDaily;
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
      notificationsActions.pushError(e instanceof Error ? e.message : "Failed to load board");
    }
  }

  async function pullBoardState() {
    try {
      const board = await boardGetState();
      setState(
        produce((s) => {
          s.board = board;
        })
      );
    } catch {
      // ignore periodic pull errors
    }
  }

  async function pullQuests() {
    try {
      // refresh quest progress on server, then read quests
      await apiPost("/api/quests/refresh", {});
      const questsAll = await apiGet<QuestMeta[]>("/api/quests");
      const active = await apiGet<QuestMeta[]>("/api/quests/active");
      const daily = await apiGet<QuestMeta[]>("/api/quests/daily");

      for (const q of questsAll) {
        if (q.status === "complete" && !completedQuestIds.has(q.id)) {
          completedQuestIds.add(q.id);
          notificationsActions.push({ kind: "success", title: "Quest completed!", message: q.title, ttlMs: 3200 });
        }
      }

      setState(
        produce((s) => {
          s.questsActive = active;
          s.questsDaily = daily;
        })
      );
    } catch {
      // ignore periodic quest poll errors
    }
  }

  function setCamera(next: CameraState) {
    setState(
      produce((s) => {
        s.camera = next;
      })
    );
  }

  function optimisticMove(entityId: string, x: number, y: number) {
    setState(
      produce((s) => {
        const b = s.board;
        if (!b) return;
        b.entities = b.entities.map((e) => (e.id === entityId ? { ...e, x, y } : e));
      })
    );
  }

  async function persistMove(entityId: string, x: number, y: number) {
    const res = await boardMove(entityId, x, y);
    setState(
      produce((s) => {
        s.board = res.state;
        s.lastEvents = res.events;
      })
    );
    notificationsActions.pushFromBoardEvents(res.events);
  }

  async function spawnDeck(deckId: string) {
    const res = await boardSpawnDeck(deckId);
    setState(
      produce((s) => {
        s.board = res.state;
        s.lastEvents = res.events;
      })
    );
    notificationsActions.pushInfo("Deck spawned");
  }

  async function openDeck(deckEntityId: string) {
    const res = await boardOpenDeck(deckEntityId);
    const loot = await apiGet<LootInventoryDto>("/api/loot");
    setState(
      produce((s) => {
        s.board = res.state;
        s.lastEvents = res.events;
        s.loot = loot;
      })
    );
    notificationsActions.pushFromBoardEvents(res.events);
  }

  async function stack(sourceId: string, targetId: string) {
    const res = await boardStack(sourceId, targetId);
    setState(
      produce((s) => {
        s.board = res.state;
        s.lastEvents = res.events;
      })
    );
    notificationsActions.pushFromBoardEvents(res.events);
  }

  async function unstack(stackId: string) {
    const res = await boardUnstack(stackId);
    setState(
      produce((s) => {
        s.board = res.state;
        s.lastEvents = res.events;
      })
    );
    notificationsActions.pushFromBoardEvents(res.events);
  }

  async function collect(entityId: string) {
    const res = await boardCollect(entityId);
    const loot = await apiGet<LootInventoryDto>("/api/loot");
    setState(
      produce((s) => {
        s.board = res.state;
        s.lastEvents = res.events;
        s.loot = loot;
      })
    );
    notificationsActions.pushFromBoardEvents(res.events);
  }

  async function sell(entityId: string) {
    const res = await boardSell(entityId);
    const loot = await apiGet<LootInventoryDto>("/api/loot");
    setState(
      produce((s) => {
        s.board = res.state;
        s.lastEvents = res.events;
        s.loot = loot;
      })
    );
    notificationsActions.pushFromBoardEvents(res.events);
  }

  return {
    state,
    actions: {
      load,
      pullBoardState,
      pullQuests,
      showToast,
      setCamera,
      optimisticMove,
      persistMove,
      spawnDeck,
      openDeck,
      stack,
      unstack,
      collect,
      sell
    }
  };
}


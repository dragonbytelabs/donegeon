import { createStore, produce } from "solid-js/store";
import type { BoardEventDto, BoardStateDto, LootInventoryDto, TodaySummaryDto, VillagerDto } from "@donegeon/app/api";
import { apiGet, apiPost } from "../lib/api";
import {
  boardCollect,
  boardGetState,
  boardTick,
  boardMove,
  boardOpenDeck,
  boardSell,
  boardStartWork,
  boardSpawnDeck,
  boardStack,
  boardTrash,
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
  questsAll: QuestMeta[];
  questsActive: QuestMeta[];
  questsDaily: QuestMeta[];
  lastEvents: BoardEventDto[];
  animOffsets: Record<string, { dx: number; dy: number }>;

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
    questsAll: [],
    questsActive: [],
    questsDaily: [],
    lastEvents: [],
    animOffsets: {},
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
          s.questsAll = questsAll;
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
      const res = await boardTick();
      setState(
        produce((s) => {
          s.board = res.state;
          s.lastEvents = res.events;
        })
      );
      notificationsActions.pushFromBoardEvents(res.events);
    } catch {
      // ignore periodic pull errors
    }
  }

  async function pullQuests() {
    try {
      // refresh quest progress on server (returns events for newly completed quests)
      const refreshResult = await apiPost<{ status: string; events?: BoardEventDto[] }>("/api/quests/refresh", {});
      const questsAll = await apiGet<QuestMeta[]>("/api/quests");
      const active = await apiGet<QuestMeta[]>("/api/quests/active");
      const daily = await apiGet<QuestMeta[]>("/api/quests/daily");

      setState(
        produce((s) => {
          s.questsAll = questsAll;
          s.questsActive = active;
          s.questsDaily = daily;
        })
      );

      // Show notifications for quest events (e.g. newly completed quests)
      if (refreshResult.events) {
        notificationsActions.pushFromBoardEvents(refreshResult.events);
      }
    } catch {
      // ignore periodic quest poll errors
    }
  }

  async function claimQuest(id: string) {
    const res = await apiPost<{ rewards: any[]; events?: BoardEventDto[] }>(`/api/quests/${id}/complete`, {});
    const loot = await apiGet<LootInventoryDto>("/api/loot");
    await pullQuests();
    setState(
      produce((s) => {
        s.loot = loot;
      })
    );
    if (res.events) notificationsActions.pushFromBoardEvents(res.events);
    else notificationsActions.pushSuccess("Quest claimed", `${res.rewards?.length ?? 0} reward(s)`);
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
    
    // Handle wiggle events: animate the nudge from requested position to actual position
    const wiggleEvent = res.events.find((e) => e.kind === "wiggle" && e.entity_id === entityId);
    if (wiggleEvent && wiggleEvent.kind === "wiggle") {
      const actual = wiggleEvent.to;
      const requested = { x, y };
      const dx = requested.x - actual.x;
      const dy = requested.y - actual.y;
      
      setState(
        produce((s) => {
          s.board = res.state;
          s.lastEvents = res.events;
          // Set initial offset to show card at requested position
          s.animOffsets[entityId] = { dx, dy };
        })
      );
      
      // Next tick: animate to actual position (0 offset)
      setTimeout(() => {
        setState(
          produce((s) => {
            if (s.animOffsets[entityId]) {
              s.animOffsets[entityId] = { dx: 0, dy: 0 };
            }
          })
        );
      }, 0);
      
      // Cleanup after animation completes
      setTimeout(() => {
        setState(
          produce((s) => {
            delete s.animOffsets[entityId];
          })
        );
      }, 360);
    } else {
      setState(
        produce((s) => {
          s.board = res.state;
          s.lastEvents = res.events;
        })
      );
    }
    
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
    // v0.7: timed fanout animation driven by server event payload
    const fan = res.events.find((e) => e.kind === "deck_open_fanout");
    if (fan && fan.kind === "deck_open_fanout") {
      setState(
        produce((s) => {
          const b = res.state;
          const byId: Record<string, { x: number; y: number }> = {};
          for (const e of b.entities) byId[e.id] = { x: e.x, y: e.y };
          for (const cid of fan.card_entity_ids) {
            const p = byId[cid];
            if (!p) continue;
            s.animOffsets[cid] = { dx: fan.origin.x - p.x, dy: fan.origin.y - p.y };
          }
        })
      );
      // next tick: animate offsets to 0
      setTimeout(() => {
        setState(
          produce((s) => {
            for (const cid of fan.card_entity_ids) {
              if (!s.animOffsets[cid]) continue;
              s.animOffsets[cid] = { dx: 0, dy: 0 };
            }
          })
        );
      }, 0);
      // cleanup
      setTimeout(() => {
        setState(
          produce((s) => {
            for (const cid of fan.card_entity_ids) delete s.animOffsets[cid];
          })
        );
      }, 360);
    }
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

  async function trash(entityId: string) {
    const res = await boardTrash(entityId);
    setState(
      produce((s) => {
        s.board = res.state;
        s.lastEvents = res.events;
      })
    );
    notificationsActions.pushFromBoardEvents(res.events);
  }

  async function startWork(villagerEntityId: string, targetEntityId: string) {
    const res = await boardStartWork(villagerEntityId, targetEntityId);
    setState(
      produce((s) => {
        s.board = res.state;
        s.lastEvents = res.events;
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
      claimQuest,
      showToast,
      setCamera,
      optimisticMove,
      persistMove,
      spawnDeck,
      openDeck,
      stack,
      unstack,
      collect,
      sell,
      trash,
      startWork
    }
  };
}


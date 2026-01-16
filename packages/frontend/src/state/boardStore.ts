import { createStore, produce } from "solid-js/store";
import type { BoardEventDto, BoardStateDto, LootInventoryDto, TodaySummaryDto, VillagerDto } from "@donegeon/app/api";
import { apiGet } from "../lib/api";
import {
  boardCollect,
  boardGetState,
  boardMove,
  boardOpenDeck,
  boardSpawnDeck,
  boardStack,
  boardUnstack
} from "../lib/boardApi";

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

export type BoardUiState = {
  board: BoardStateDto | null;
  loot: LootInventoryDto | null;
  today: TodaySummaryDto | null;
  villagers: VillagerDto[];
  decks: DeckMeta[];
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
      const [board, loot, today, villagers, decks] = await Promise.all([
        boardGetState(),
        apiGet<LootInventoryDto>("/api/loot"),
        apiGet<TodaySummaryDto>("/api/today"),
        apiGet<VillagerDto[]>("/api/villagers"),
        apiGet<DeckMeta[]>("/api/decks")
      ]);
      setState(
        produce((s) => {
          s.board = board;
          s.loot = loot;
          s.today = today;
          s.villagers = villagers;
          s.decks = decks;
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
  }

  async function spawnDeck(deckId: string) {
    const res = await boardSpawnDeck(deckId);
    setState(
      produce((s) => {
        s.board = res.state;
        s.lastEvents = res.events;
      })
    );
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
  }

  async function stack(sourceId: string, targetId: string) {
    const res = await boardStack(sourceId, targetId);
    setState(
      produce((s) => {
        s.board = res.state;
        s.lastEvents = res.events;
      })
    );
  }

  async function unstack(stackId: string) {
    const res = await boardUnstack(stackId);
    setState(
      produce((s) => {
        s.board = res.state;
        s.lastEvents = res.events;
      })
    );
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
  }

  return {
    state,
    actions: {
      load,
      pullBoardState,
      showToast,
      setCamera,
      optimisticMove,
      persistMove,
      spawnDeck,
      openDeck,
      stack,
      unstack,
      collect
    }
  };
}


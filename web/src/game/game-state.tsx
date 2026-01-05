import React, { createContext, useContext, useMemo } from "react";
import { useImmer } from "use-immer";
import type { Task } from "../lib/types";
import { taskToGameCard, type GameCardModel } from "./types";
import { ZONES, type ZoneId, pilePlacement } from "./zones";
import { api } from "../lib/api";

export type PlacedCard = GameCardModel & {
  x: number;
  y: number;
  rot: number;
  z: number;
  zone?: ZoneId; // "table" | zone id
};

export type GameState = {
  // Source-of-truth for game board
  cards: PlacedCard[];

  // Which *task ids* have been drawn into the game (so deck draws are stable)
  drawnTaskIds: Record<string, true>;

  // z-index allocator
  nextZ: number;

  // optional: keep the last tasks snapshot for "deck draw"
  tasks: Task[];
};

type GameActions = {
  setTasks(tasks: Task[]): void;

  clearBoard(): void;
  openInboxDeck(count?: number): void;

  bringToFront(id: string): void;
  moveCard(id: string, x: number, y: number): void;
  snapToZone(id: string, zone: ZoneId): Promise<void>;
  removeCard(id: string): void;

  remainingUndrawn(): number;
};

const GameStateCtx = createContext<{ st: GameState; act: GameActions } | null>(null);

// -------- helpers (pure) --------

function hash01(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 2 ** 32;
}

function pickUndrawn(tasks: Task[], drawn: Record<string, true>) {
  return tasks.filter((t) => !drawn[String(t.id)]);
}

function scatterPlacement(seed: string) {
  const baseX = 300;
  const baseY = 110;
  const spreadX = 760;
  const spreadY = 540;

  const a = hash01(seed + ":a");
  const b = hash01(seed + ":b");
  const r = hash01(seed + ":r");

  const x = baseX + a * spreadX;
  const y = baseY + b * spreadY;
  const rot = (r * 2 - 1) * 10;
  return { x, y, rot };
}

function findCardIndex(cards: PlacedCard[], id: string) {
  return cards.findIndex((c) => c.id === id);
}

// -------- provider --------

export function GameStateProvider({
  children,
  initialTasks = [],
}: {
  children: React.ReactNode;
  initialTasks?: Task[];
}) {
  const [st, update] = useImmer<GameState>({
    cards: [],
    drawnTaskIds: {},
    nextZ: 1,
    tasks: initialTasks,
  });

  const act: GameActions = useMemo(() => {
    function setTasks(tasks: Task[]) {
      update((d) => {
        d.tasks = tasks;
      });
    }

    function remainingUndrawn() {
      return pickUndrawn(st.tasks, st.drawnTaskIds).length;
    }

    function clearBoard() {
      console.log("[board] clear");
      update((d) => {
        d.cards = [];
        d.drawnTaskIds = {};
        d.nextZ = 1;
      });
    }

    function openInboxDeck(count = 3) {
      const pool = pickUndrawn(st.tasks, st.drawnTaskIds);
      console.log("[deck] open inbox deck", { count, remaining: pool.length });

      if (pool.length === 0) return;

      // choose first N from undrawn for now (later: random weighted)
      const chosen = pool.slice(0, count);

      update((d) => {
        for (const t of chosen) {
          const model = taskToGameCard(t);

          const z = d.nextZ++;
          const seed = `task:${t.id}:${z}`;
          const { x, y, rot } = scatterPlacement(seed);

          d.cards.push({
            ...model,
            x,
            y,
            rot,
            z,
            zone: "table",
          });

          d.drawnTaskIds[String(t.id)] = true;
        }
      });
    }

    function bringToFront(id: string) {
      update((d) => {
        const idx = findCardIndex(d.cards, id);
        if (idx === -1) return;
        d.cards[idx].z = d.nextZ++;
      });
    }

    function moveCard(id: string, x: number, y: number) {
      update((d) => {
        const idx = findCardIndex(d.cards, id);
        if (idx === -1) return;
        d.cards[idx].x = x;
        d.cards[idx].y = y;
        d.cards[idx].zone = "table";
      });
    }

    function snapToZone(id: string, zoneId: ZoneId) {
      const zone = ZONES.find((z) => z.id === zoneId);
      if (!zone) return Promise.resolve();

      // Handle special zones with backend actions
      if (zoneId === "graveyard") {
        // Complete the task
        const card = st.cards.find((c) => c.id === id);
        if (card && card.taskId) {
          api.completeTask(card.taskId)
            .then((result) => {
              console.log("[complete] task", card.taskId, "loot:", result.loot_drops);
              // Remove the card from the board
              removeCard(id);
              
              // Spawn loot drop cards
              if (result.loot_drops && result.loot_drops.length > 0) {
                update((d) => {
                  result.loot_drops.forEach((loot, i) => {
                    const lootCard: PlacedCard = {
                      id: `loot-${Date.now()}-${i}`,
                      taskId: 0,
                      title: loot.type,
                      subtitle: `x${loot.amount}`,
                      description: "",
                      x: 400 + i * 60,
                      y: 400,
                      rot: (Math.random() * 2 - 1) * 8,
                      z: d.nextZ++,
                      zone: "table",
                    };
                    d.cards.push(lootCard);
                  });
                });
              }
              
              // Trigger page reload to refresh task list and inventory
              const revalidator = (window as any).__gameRevalidator;
              if (revalidator) {
                setTimeout(() => revalidator.revalidate(), 500);
              }
            })
            .catch((err) => {
              console.error("[complete] error", err);
            });
        }
        return Promise.resolve();
      }

      if (zoneId === "recycle") {
        // Recycle the card for coins
        const card = st.cards.find((c) => c.id === id);
        if (card) {
          console.log("[recycle]", id);
          // TODO: Add coins to inventory
          removeCard(id);
        }
        return Promise.resolve();
      }

      update((d) => {
        const idx = findCardIndex(d.cards, id);
        if (idx === -1) return;

        const stackIndex = d.cards.filter((c) => c.zone === zoneId && c.id !== id).length;
        const { x, y, rot } = pilePlacement(zone, stackIndex);

        const c = d.cards[idx];
        c.x = x;
        c.y = y;
        c.rot = rot;
        c.zone = zoneId;
        c.z = d.nextZ++;
      });

      console.log("[snap]", { id, zone: zoneId });
      return Promise.resolve();
    }

    function removeCard(id: string) {
      update((d) => {
        const idx = findCardIndex(d.cards, id);
        if (idx !== -1) {
          d.cards.splice(idx, 1);
        }
      });
    }

    return {
      setTasks,
      clearBoard,
      openInboxDeck,
      bringToFront,
      moveCard,
      snapToZone,
      removeCard,
      remainingUndrawn,
    };
  }, [st.tasks, st.drawnTaskIds, st.nextZ, st.cards, update]);

  return <GameStateCtx.Provider value={{ st, act }}>{children}</GameStateCtx.Provider>;
}

export function useGameState() {
  const v = useContext(GameStateCtx);
  if (!v) throw new Error("useGameState must be used inside <GameStateProvider>");
  return v;
}

import type { Engine } from "@donegeon/core";
import { snapToGrid } from "@donegeon/core";
import { clientToBoard } from "./geom.dom";
import { getPan, setPan, applyPan } from "./pan";
import { scheduleLiveSync } from "./liveSync";
import { scheduleSave } from "./storage";
import {
  cmdDeckOpenPack,
  cmdDeckSpawnPack,
  cmdFoodConsume,
  cmdLootCollectStack,
  cmdResourceGather,
  cmdStackMerge,
  cmdStackMove,
  cmdStackSplit,
  cmdTaskAssignVillager,
  cmdZombieClear,
  reloadBoard,
} from "./api";
import { startStackActivity, clearStackActivity } from "./activity";
import { isCollectableLoot, refreshInventory } from "./inventory";
import { notify } from "./notify";

const MERGE_THRESHOLD_AREA = 92 * 40; // same spirit as legacy
const DRAG_CLICK_SLOP_PX = 6; // movement threshold to still count as click

type DragState =
  | {
    stackId: string;
    pointerId: number;
    offX: number;
    offY: number
    startClientX: number;
    startClientY: number;
    mode: "stack" | "maybe-card" | "card";
    cardIndex: number | null;
    moved: boolean;
  }
  | null;

function stackNodeById(id: string): HTMLElement | null {
  return document.querySelector(`.sl-stack[data-stack-id="${id}"]`) as HTMLElement | null;
}

function rect(el: HTMLElement) {
  return el.getBoundingClientRect();
}

function intersectArea(a: DOMRect, b: DOMRect) {
  const x1 = Math.max(a.left, b.left);
  const y1 = Math.max(a.top, b.top);
  const x2 = Math.min(a.right, b.right);
  const y2 = Math.min(a.bottom, b.bottom);
  const w = x2 - x1;
  const h = y2 - y1;
  return w > 0 && h > 0 ? w * h : 0;
}

function bestMergeTarget(engine: Engine, draggedId: string): string | null {
  const draggedNode = stackNodeById(draggedId);
  if (!draggedNode) return null;

  const dr = rect(draggedNode);
  let best: string | null = null;
  let bestScore = 0;

  for (const id of engine.stacks.keys()) {
    if (id === draggedId) continue;

    const node = stackNodeById(id);
    if (!node) continue;

    const score = intersectArea(dr, rect(node));
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }

  return bestScore >= MERGE_THRESHOLD_AREA ? best : null;
}

function bestCollectDeckTarget(engine: Engine, draggedId: string): string | null {
  const draggedNode = stackNodeById(draggedId);
  if (!draggedNode) return null;

  const dr = rect(draggedNode);
  let best: string | null = null;
  let bestScore = 0;

  for (const id of engine.stacks.keys()) {
    if (id === draggedId) continue;
    const stack = engine.getStack(id);
    if (!stackHasDef(stack, "deck.collect")) continue;

    const node = stackNodeById(id);
    if (!node) continue;

    const score = intersectArea(dr, rect(node));
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }

  return bestScore >= MERGE_THRESHOLD_AREA ? best : null;
}

function pointerDropTargetStackId(clientX: number, clientY: number, excludeStackId: string): string | null {
  const draggedNode = stackNodeById(excludeStackId);
  if (draggedNode) draggedNode.style.pointerEvents = "none";

  const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;

  if (draggedNode) draggedNode.style.pointerEvents = "";
  if (!el) return null;

  const stackEl = el.closest(".sl-stack") as HTMLElement | null;
  if (!stackEl) return null;

  const stackId = stackEl.dataset.stackId;
  if (!stackId || stackId === excludeStackId) return null;

  return stackId;
}

function stackHasKind(stack: any, kind: string): boolean {
  if (!stack) return false;
  const cards = stack.cards?.[0]?.() ?? [];
  for (const c of cards as any[]) {
    if (c?.def?.kind === kind) return true;
  }
  return false;
}

function stackHasDef(stack: any, defId: string): boolean {
  if (!stack) return false;
  const cards = stack.cards?.[0]?.() ?? [];
  for (const c of cards as any[]) {
    if (c?.def?.id === defId) return true;
  }
  return false;
}

function firstCardByKind(stack: any, kind: string): any | null {
  if (!stack) return null;
  const cards = stack.cards?.[0]?.() ?? [];
  for (let i = cards.length - 1; i >= 0; i -= 1) {
    const card = cards[i];
    if (card?.def?.kind === kind) return card;
  }
  return null;
}

function gatherDurationMs(resourceStack: any): number {
  const resourceCard = firstCardByKind(resourceStack, "resource");
  const fromData = Number(resourceCard?.data?.gatherTimeS ?? 0);
  if (Number.isFinite(fromData) && fromData > 0) {
    return Math.max(350, fromData * 1000);
  }

  const defId = String(resourceCard?.def?.id ?? "");
  switch (defId) {
    case "resource.scrap_pile":
      return 10000;
    case "resource.mushroom_patch":
      return 8000;
    case "resource.berry_bush":
      return 6000;
    default:
      return 5000;
  }
}

function canCollectStackCard(defId: string): boolean {
  if (isCollectableLoot(defId)) return true;
  if (defId === "task.blank") return true;
  if (defId.startsWith("mod.")) return true;
  if (defId.startsWith("resource.")) return true;
  return false;
}

/**
 * Pan rules:
 * - Desktop: RIGHT mouse drag on empty space.
 * - Touch/Tablet: 1-finger drag on empty space pans.
 */
function bindMobilePan(boardRoot: HTMLElement, boardEl: HTMLElement) {
  boardRoot.style.touchAction = "none";
  boardRoot.addEventListener("contextmenu", (e) => e.preventDefault());

  const canStartPan = (t: HTMLElement) => !t.closest(".sl-card") && !t.closest(".sl-stack");

  let active:
    | { pointerId: number; startX: number; startY: number; startPanX: number; startPanY: number }
    | null = null;

  function onMove(e: PointerEvent) {
    if (!active) return;
    if (e.pointerId !== active.pointerId) return;

    e.preventDefault();

    const dx = e.clientX - active.startX;
    const dy = e.clientY - active.startY;

    setPan(active.startPanX + dx, active.startPanY + dy);
    applyPan(boardEl);
  }

  function onUp(e: PointerEvent) {
    if (!active) return;
    if (e.pointerId !== active.pointerId) return;

    active = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  }

  boardRoot.addEventListener("pointerdown", (e) => {
    const pe = e as PointerEvent;
    const t = pe.target as HTMLElement;

    if (!canStartPan(t)) return;

    // Desktop: right mouse only
    if (e.pointerType === "mouse" && e.button !== 2) return;

    // Touch/pen: primary only (ignore right-click semantics)
    if (e.pointerType !== "mouse" && e.button === 2) return;

    e.preventDefault();

    const cur = getPan();
    active = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: cur.x,
      startPanY: cur.y,
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  });
}

// Minimal long-press hook; keep API, don’t invent core types.
function bindLongPressMenu(_engine: Engine, boardRoot: HTMLElement) {
  // You can later wire a real context menu here.
  boardRoot.addEventListener("contextmenu", (e) => e.preventDefault());
}

/**
 * Stack drag + merge + open interactions.
 * (Keeps it tight: no unstack/split UX here yet.)
 */
function bindBoardInput(engine: Engine, boardRoot: HTMLElement, boardEl: HTMLElement) {
  boardRoot.addEventListener("contextmenu", (e) => e.preventDefault());

  let drag: DragState = null;

  boardEl.addEventListener("pointerdown", (e) => {
    const pe = e as PointerEvent;
    const t = pe.target as HTMLElement;
    if (t.closest('[data-action="task-info"]')) return;

    const cardEl = t.closest(".sl-card") as HTMLElement | null;
    const stackNode = t.closest(".sl-stack") as HTMLElement | null;
    if (!stackNode) return;

    if (pe.pointerType === "mouse" && pe.button === 2) return;

    const stackId = stackNode.dataset.stackId!;
    const s = engine.getStack(stackId);
    if (!s) return;

    const cardIndexStr = cardEl?.dataset?.cardIndex;
    const cardIndex = cardIndexStr != null ? Number(cardIndexStr) : null;

    // Decide intent:
    // - If you grabbed the TOP card: drag the stack (existing behavior)
    // - If you grabbed a LOWER card: peel (split on release)
    const cards = s.cards[0]();
    const topIdx = cards.length - 1;
    const isOnCard = cardIndex != null && cardIndex >= 0;
    const isTopCard = isOnCard && cardIndex === topIdx;

    const mode: DragState extends infer D
      ? D extends { mode: infer M } ? M : never
      : never = isTopCard ? "stack" : isOnCard ? "maybe-card" : "stack";

    engine.bringToFront(stackId);
    stackNode.setPointerCapture(pe.pointerId);

    const pan = getPan();
    const p = clientToBoard(pe.clientX, pe.clientY, boardRoot, pan);
    const sp = s.pos[0]();

    drag = {
      stackId,
      pointerId: pe.pointerId,
      offX: p.x - sp.x,
      offY: p.y - sp.y,
      startClientX: pe.clientX,
      startClientY: pe.clientY,
      mode,
      cardIndex,
      moved: false,
    };
  });


  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (e.pointerId !== drag.pointerId) return;

    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    const movedNow = dx * dx + dy * dy > DRAG_CLICK_SLOP_PX * DRAG_CLICK_SLOP_PX;

    // Promote maybe-card → card once we actually move
    if (drag.mode === "maybe-card" && movedNow) {
      drag.mode = "card";
    }

    if (!drag.moved && movedNow) drag.moved = true;

    const s = engine.getStack(drag.stackId);
    if (!s) return;

    // Only move the whole stack if we are doing a stack drag.
    // For card drags, we don't move anything yet (we'll split on pointerup).
    if (drag.mode !== "stack") return;

    const pan = getPan();
    const p = clientToBoard(e.clientX, e.clientY, boardRoot, pan);
    s.pos[1]({ x: p.x - drag.offX, y: p.y - drag.offY });
  });

  boardEl.addEventListener("pointerup", (e) => {
    // If this pointerup is ending a drag that actually moved, do NOT treat as click/open.
    if (drag && e.pointerId === drag.pointerId && drag.moved) return;

    const path = (e.composedPath?.() ?? []) as EventTarget[];
    const infoBtn = path.find(
      (n): n is HTMLElement =>
        n instanceof HTMLElement && n.matches('[data-action="task-info"]')
    );

    if (infoBtn) {
      e.preventDefault();
      e.stopPropagation();

      const stackEl = infoBtn.closest(".sl-stack") as HTMLElement | null;
      if (!stackEl) return;

      const stackId = stackEl.dataset.stackId!;
      const cardEl = infoBtn.closest(".sl-card") as HTMLElement | null;
      const cardIndex = cardEl ? Number(cardEl.dataset.cardIndex ?? "-1") : -1;

      boardEl.dispatchEvent(
        new CustomEvent("donegeon:task-info", {
          bubbles: true,
          detail: { stackId, cardIndex },
        })
      );
      return;
    }

    // normal click handling (NOT info button)
    const t = e.target as HTMLElement;
    const stackEl = t.closest(".sl-stack") as HTMLElement | null;
    if (!stackEl) return;

    const stackId = stackEl.dataset.stackId!;
    const s = engine.getStack(stackId);
    if (!s) return;

    const top = s.topCard();
    if (!top) return;

    const isDeckCard = top.def.kind === "deck" && !top.def.id.endsWith("_pack");
    const canSpawnPack = isDeckCard && top.def.id !== "deck.collect";
    if (canSpawnPack) {
      const br = boardRoot.getBoundingClientRect();
      const cx = br.left + br.width * 0.55;
      const cy = br.top + br.height * 0.45;
      const p = clientToBoard(cx, cy, boardRoot, getPan());

      void cmdDeckSpawnPack(stackId, p.x, p.y, "deck.first_day_pack")
        .then(() => reloadBoard(engine))
        .then(() => {
          notify("Deck pack spawned", "info", 1400);
        })
        .then(() => scheduleLiveSync(engine))
        .catch((err) => {
          console.warn("deck pack spawn sync failed", err);
          notify(`Deck spawn failed: ${String((err as Error)?.message ?? err)}`, "error");
          void reloadBoard(engine).catch(() => {});
        });

      return;
    }

    if (top.def.id.endsWith("_pack")) {
      const deckIdFromPack = typeof (top.data as any)?.deckId === "string"
        ? String((top.data as any).deckId)
        : "deck.first_day";
      void cmdDeckOpenPack(stackId, deckIdFromPack)
        .then(() => reloadBoard(engine))
        .then(() => refreshInventory())
        .then(() => {
          notify("Deck opened", "success", 1600);
        })
        .then(() => scheduleLiveSync(engine))
        .catch((err) => {
          console.warn("deck open sync failed", err);
          notify(`Deck open failed: ${String((err as Error)?.message ?? err)}`, "error");
          void reloadBoard(engine).catch(() => {});
        });
      return;
    }
  });

  window.addEventListener("pointerup", (e) => {
    if (!drag) return;

    const ended = drag;
    drag = null;

    const s = engine.getStack(ended.stackId);
    if (!s) return;

    // --- CARD DRAG: peel/split, drop new stack at pointer position ---
    if (ended.mode === "card" && ended.moved && ended.cardIndex != null) {
      const pan = getPan();
      const drop = clientToBoard(e.clientX, e.clientY, boardRoot, pan);
      const snappedPos = snapToGrid(drop.x, drop.y);
      void cmdStackSplit(ended.stackId, ended.cardIndex, 18, 18, snappedPos.x, snappedPos.y)
        .then(() => reloadBoard(engine))
        .then(() => scheduleLiveSync(engine))
        .catch((err) => {
          console.warn("split sync failed", err);
          void reloadBoard(engine).catch(() => {});
        });

      return;
    }

    // --- STACK DRAG: existing behavior ---
    const didMove = ended.moved;

    // snap moved stack
    const p = s.pos[0]();
    const snappedPos = snapToGrid(p.x, p.y);
    s.pos[1](snappedPos);

    // merge only if it was a real drag
    if (didMove) {
      const collectTarget = bestCollectDeckTarget(engine, ended.stackId);
      if (collectTarget) {
        const sourceStack = engine.getStack(ended.stackId);
        const sourceTopCard = sourceStack?.topCard();
        if (sourceTopCard && sourceStack) {
          const sourceCards = sourceStack.cards?.[0]?.() ?? [];
          const isSingleCardStack = sourceCards.length === 1;
          if (isSingleCardStack && canCollectStackCard(sourceTopCard.def.id)) {
            scheduleSave(engine);
            void cmdLootCollectStack(ended.stackId)
              .then(() => reloadBoard(engine))
              .then(() => refreshInventory())
              .then(() => {
                notify("Card salvaged for loot", "success", 1400);
              })
              .then(() => scheduleLiveSync(engine))
              .catch((err) => {
                console.warn("collect sync failed", err);
                notify(`Collect failed: ${String((err as Error)?.message ?? err)}`, "error");
                void reloadBoard(engine).catch(() => {});
              });
            return;
          }
        }
        // Do not attempt a normal merge onto collect deck for non-collectables.
        void reloadBoard(engine).catch(() => {});
        return;
      }

      const dropTarget = pointerDropTargetStackId(e.clientX, e.clientY, ended.stackId);
      const target = dropTarget || bestMergeTarget(engine, ended.stackId);
      if (target) {
        // Safety check in case collect deck wasn't the best overlap target.
        const targetStack = engine.getStack(target);
        const sourceStack = engine.getStack(ended.stackId);
        const sourceTopCard = sourceStack?.topCard();

        if (stackHasDef(targetStack, "deck.collect") && sourceTopCard && sourceStack) {
          const sourceCards = sourceStack.cards?.[0]?.() ?? [];
          const isSingleCardStack = sourceCards.length === 1;
          if (isSingleCardStack && canCollectStackCard(sourceTopCard.def.id)) {
            scheduleSave(engine);
            void cmdLootCollectStack(ended.stackId)
              .then(() => reloadBoard(engine))
              .then(() => refreshInventory())
              .then(() => {
                notify("Card salvaged for loot", "success", 1400);
              })
              .then(() => scheduleLiveSync(engine))
              .catch((err) => {
                console.warn("collect sync failed", err);
                notify(`Collect failed: ${String((err as Error)?.message ?? err)}`, "error");
                void reloadBoard(engine).catch(() => {});
              });
            return;
          }
          // Do not attempt a normal merge onto collect deck for non-collectables.
          void reloadBoard(engine).catch(() => {});
          return;
        }

        // Normal merge behavior goes through server; then rehydrate.
        const targetHasTask = stackHasKind(targetStack, "task");
        const sourceHasTask = stackHasKind(sourceStack, "task");
        const targetHasVillager = stackHasKind(targetStack, "villager");
        const sourceHasVillager = stackHasKind(sourceStack, "villager");
        const targetHasZombie = stackHasKind(targetStack, "zombie");
        const sourceHasZombie = stackHasKind(sourceStack, "zombie");
        const targetHasResource = stackHasKind(targetStack, "resource");
        const sourceHasResource = stackHasKind(sourceStack, "resource");
        const targetHasFood = stackHasKind(targetStack, "food");
        const sourceHasFood = stackHasKind(sourceStack, "food");

        if ((targetHasTask && sourceHasVillager) || (sourceHasTask && targetHasVillager)) {
          const taskStackId = targetHasTask ? target : ended.stackId;
          const villagerStackId = targetHasVillager ? target : ended.stackId;
          void cmdTaskAssignVillager(taskStackId, villagerStackId, target)
            .then(() => reloadBoard(engine))
            .then(() => scheduleLiveSync(engine))
            .then(() => refreshInventory())
            .then(() => {
              notify("Villager assigned to task", "success", 1500);
            })
            .catch((err) => {
              console.warn("assign villager sync failed", err);
              notify(`Assign failed: ${String((err as Error)?.message ?? err)}`, "error");
              void reloadBoard(engine).catch(() => {});
            });
          return;
        }

        if ((targetHasZombie && sourceHasVillager) || (sourceHasZombie && targetHasVillager)) {
          const zombieStackId = targetHasZombie ? target : ended.stackId;
          const villagerStackId = targetHasVillager ? target : ended.stackId;
          void cmdZombieClear(zombieStackId, villagerStackId, target)
            .then(() => reloadBoard(engine))
            .then(() => refreshInventory())
            .then(() => {
              notify("Zombie defeated", "success", 1700);
            })
            .then(() => scheduleLiveSync(engine))
            .catch((err) => {
              console.warn("zombie clear sync failed", err);
              notify(`Zombie clear failed: ${String((err as Error)?.message ?? err)}`, "error");
              void reloadBoard(engine).catch(() => {});
            });
          return;
        }

        if ((targetHasResource && sourceHasVillager) || (sourceHasResource && targetHasVillager)) {
          const resourceStackId = targetHasResource ? target : ended.stackId;
          const villagerStackId = targetHasVillager ? target : ended.stackId;
          const durationMs = gatherDurationMs(engine.getStack(resourceStackId));
          const actionLabel = stackHasDef(engine.getStack(resourceStackId), "resource.scrap_pile")
            ? "Mining"
            : "Gathering";

          void startStackActivity(resourceStackId, actionLabel, durationMs)
            .then(() => cmdResourceGather(resourceStackId, villagerStackId, target))
            .then(() => reloadBoard(engine))
            .then(() => refreshInventory())
            .then(() => {
              notify("Resource cycle complete", "success", 1700);
            })
            .then(() => scheduleLiveSync(engine))
            .catch((err) => {
              console.warn("resource gather sync failed", err);
              notify(`Gather failed: ${String((err as Error)?.message ?? err)}`, "error");
              void reloadBoard(engine).catch(() => {});
            })
            .finally(() => {
              clearStackActivity(resourceStackId);
            });
          return;
        }

        if ((targetHasFood && sourceHasVillager) || (sourceHasFood && targetHasVillager)) {
          const foodStackId = targetHasFood ? target : ended.stackId;
          const villagerStackId = targetHasVillager ? target : ended.stackId;
          void cmdFoodConsume(foodStackId, villagerStackId, target)
            .then(() => reloadBoard(engine))
            .then(() => refreshInventory())
            .then(() => {
              notify("Villager stamina restored", "success", 1600);
            })
            .then(() => scheduleLiveSync(engine))
            .catch((err) => {
              console.warn("food consume sync failed", err);
              notify(`Eat failed: ${String((err as Error)?.message ?? err)}`, "error");
              void reloadBoard(engine).catch(() => {});
            });
          return;
        }

        void cmdStackMerge(target, ended.stackId)
          .then(() => reloadBoard(engine))
          .then(() => scheduleLiveSync(engine))
          .catch((err) => {
            console.warn("merge sync failed", err);
            notify(`Merge failed: ${String((err as Error)?.message ?? err)}`, "error");
            void reloadBoard(engine).catch(() => {});
          });
      } else {
        // Just a position move; local movement is optimistic and server version is updated on success.
        void cmdStackMove(ended.stackId, snappedPos.x, snappedPos.y).catch((err) => {
          console.warn("move sync failed", err);
          void reloadBoard(engine).catch(() => {});
        });
      }
      // Save position changes (engine events don't cover position moves)
      scheduleSave(engine);
    }
  });
}

export {
  bindMobilePan,
  bindLongPressMenu,
  bindBoardInput,
}

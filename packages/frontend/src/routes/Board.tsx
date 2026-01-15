import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import { A } from "@solidjs/router";
import { Button } from "@kobalte/core/button";
import type { BoardEntityDto, BoardStateDto, StackDto } from "@donegeon/app/api";
import { apiGet } from "../lib/api";
import type { LootInventoryDto, TodaySummaryDto, VillagerDto } from "@donegeon/app/api";
import {
  boardAssignTask,
  boardCollect,
  boardCompleteTask,
  boardGetState,
  boardMove,
  boardOpenDeck,
  boardSpawnDeck,
  boardStack,
  boardUnstack
} from "../lib/boardApi";
import { LegacyCard } from "../board/legacy/Card";
import { LegacyDeckCard } from "../board/legacy/DeckCard";

export default function BoardRoute() {
  const [note] = createSignal("Board v0.3: server-persisted board + legacy card styling (in progress)");
  const [board, setBoard] = createSignal<BoardStateDto | null>(null);
  const [loot, setLoot] = createSignal<LootInventoryDto | null>(null);
  const [today, setToday] = createSignal<TodaySummaryDto | null>(null);
  const [villagers, setVillagers] = createSignal<VillagerDto[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [err, setErr] = createSignal<string | null>(null);
  const [showHelp, setShowHelp] = createSignal(false);

  let boardEl!: HTMLDivElement;
  let collectDeckEl!: HTMLDivElement;

  const CARD_W = 140;
  const CARD_H = 190;

  createEffect(() => {
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        setBoard(await boardGetState());
        setLoot(await apiGet<LootInventoryDto>("/api/loot"));
        setToday(await apiGet<TodaySummaryDto>("/api/today"));
        setVillagers(await apiGet<VillagerDto[]>("/api/villagers"));
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  });

  const entitiesById = createMemo(() => {
    const b = board();
    const m: Record<string, BoardEntityDto> = {};
    if (!b) return m;
    for (const e of b.entities) m[e.id] = e;
    return m;
  });

  const stacksById = createMemo(() => {
    const b = board();
    const m: Record<string, StackDto> = {};
    if (!b) return m;
    for (const s of b.stacks) m[s.id] = s;
    return m;
  });

  const rootEntities = createMemo(() => {
    const b = board();
    if (!b) return [];
    // only render one visual per stack: prefer the task card, else first entity in that stack.
    const seenStacks = new Set<string>();
    const out: BoardEntityDto[] = [];
    for (const e of b.entities) {
      if (e.stack_id) {
        if (seenStacks.has(e.stack_id)) continue;
        const st = stacksById()[e.stack_id];
        if (st?.task_id) {
          const task = entitiesById()[st.task_id];
          if (task) {
            out.push(task);
            seenStacks.add(e.stack_id);
            continue;
          }
        }
        out.push(e);
        seenStacks.add(e.stack_id);
      } else {
        out.push(e);
      }
    }
    return out;
  });

  async function spawnDeck(deckId: string) {
    const res = await boardSpawnDeck(deckId);
    setBoard(res.state);
  }

  async function openDeck(deckEntityId: string) {
    const res = await boardOpenDeck(deckEntityId);
    setBoard(res.state);
    setLoot(await apiGet<LootInventoryDto>("/api/loot"));
  }

  async function unstack(stackId: string) {
    const res = await boardUnstack(stackId);
    setBoard(res.state);
  }

  // Drag/drop (single entity for now; stacks are moved server-side when moving a stacked entity)
  const [draggingId, setDraggingId] = createSignal<string | null>(null);
  const [dragStart, setDragStart] = createSignal<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = createSignal<{ x: number; y: number } | null>(null);

  function onPointerDownEntity(ev: PointerEvent, entityId: string) {
    if (ev.button !== 0) return;
    const b = board();
    if (!b) return;
    const ent = entitiesById()[entityId];
    if (!ent) return;
    setDraggingId(entityId);
    setDragStart({ x: ent.x, y: ent.y });
    const rect = boardEl.getBoundingClientRect();
    setDragOffset({ x: ev.clientX - (rect.left + ent.x), y: ev.clientY - (rect.top + ent.y) });
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    ev.preventDefault();
  }

  async function onPointerMoveBoard(ev: PointerEvent) {
    const id = draggingId();
    const off = dragOffset();
    if (!id || !off) return;
    const b = board();
    if (!b) return;
    const ent = entitiesById()[id];
    if (!ent) return;
    const rect = boardEl.getBoundingClientRect();
    const x = ev.clientX - rect.left - off.x;
    const y = ev.clientY - rect.top - off.y;
    // optimistic move
    setBoard({ ...b, entities: b.entities.map((e) => (e.id === id ? { ...e, x, y } : e)) });
  }

  async function onPointerUpBoard(ev: PointerEvent) {
    const id = draggingId();
    if (!id) return;
    setDraggingId(null);
    const b = board();
    if (!b) return;
    const ent = entitiesById()[id];
    if (!ent) return;

    // Collect drop zone: drop loot onto the Collect deck at bottom.
    const isLoot = ent.kind === "card" && ent.card_type === "loot";
    if (isLoot && collectDeckEl) {
      const boardRect = boardEl.getBoundingClientRect();
      const deckRect = collectDeckEl.getBoundingClientRect();
      const deckLocal = {
        left: deckRect.left - boardRect.left,
        right: deckRect.right - boardRect.left,
        top: deckRect.top - boardRect.top,
        bottom: deckRect.bottom - boardRect.top
      };
      const cx = ent.x + CARD_W / 2;
      const cy = ent.y + CARD_H / 2;
      const inCollectDeck = cx >= deckLocal.left && cx <= deckLocal.right && cy >= deckLocal.top && cy <= deckLocal.bottom;
      if (inCollectDeck) {
        const res = await boardCollect(id);
        setBoard(res.state);
        setLoot(await apiGet<LootInventoryDto>("/api/loot"));
        return;
      }
    }

    // Stack if dropped near another compatible card (very rough)
    const candidates = (b.entities ?? []).filter((e) => e.id !== id && e.kind === "card");
    const near = candidates.find((e) => Math.hypot(e.x - ent.x, e.y - ent.y) < 40);
    if (near) {
      try {
        const res = await boardStack(id, near.id);
        setBoard(res.state);
        return;
      } catch {
        // fall through to move
      }
    }

    // Persist move
    const res = await boardMove(id, ent.x, ent.y);
    setBoard(res.state);
  }

  function emojiForEntity(e: BoardEntityDto): string {
    if (e.kind === "deck") return "📦";
    if (e.card_type === "task") return "📋";
    if (e.card_type === "villager") return "🧑‍🌾";
    if (e.card_type === "loot") {
      const t = e.payload?.loot_type ?? e.subtype;
      if (t === "coin") return "🪙";
      if (t === "paper") return "📄";
      if (t === "ink") return "🖋️";
      if (t === "gear") return "⚙️";
      if (t === "parts") return "📦";
      return "🎁";
    }
    if (e.card_type === "resource") return "🍄";
    if (e.card_type === "modifier") return "⏱️";
    if (e.card_type === "food") return "🍎";
    return "🃏";
  }

  function titleForEntity(e: BoardEntityDto): string {
    if (e.kind === "deck") return "DECK";
    return e.card_type.toUpperCase();
  }

  function nameForEntity(e: BoardEntityDto): string {
    if (e.kind === "deck") return e.deck_id;
    if (e.card_type === "loot") return String(e.payload?.loot_type ?? e.subtype ?? "loot");
    if (e.card_type === "resource") return String(e.payload?.resource_card?.resource_type ?? e.subtype ?? "resource");
    if (e.card_type === "modifier") return String(e.payload?.modifier_card?.type ?? e.subtype ?? "modifier");
    if (e.card_type === "task") return String(e.payload?.task?.name ?? e.payload?.name ?? "task");
    if (e.card_type === "villager") return String(e.payload?.name ?? "villager");
    return e.card_type;
  }

  function subtitleForEntity(e: BoardEntityDto): string | undefined {
    if (e.kind === "deck") return "Click to open";
    if (e.card_type === "villager") return `${e.payload?.stamina ?? "?"}/${e.payload?.max_stamina ?? "?"} stamina`;
    if (e.card_type === "loot") return `x${e.payload?.loot_amount ?? 1}`;
    return undefined;
  }

  return (
    <main class="min-h-screen">
      <div class="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="text-xs font-semibold uppercase tracking-widest text-slate-400">Donegeon</div>
            <h1 class="mt-2 text-3xl font-black tracking-tight">Board</h1>
            <p class="mt-2 text-slate-300">{note()}</p>
          </div>
          <div class="flex items-center gap-2">
            <A href="/">
              <Button class="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                Dashboard
              </Button>
            </A>
            <div class="mx-2 h-8 w-px bg-slate-800" />
            <div class="flex items-center gap-2 rounded-md bg-slate-900/50 px-3 py-2 text-xs text-slate-200">
              <span class="font-semibold">🪙</span> {loot()?.coin ?? 0}
              <span class="font-semibold">📄</span> {loot()?.paper ?? 0}
              <span class="font-semibold">🖋️</span> {loot()?.ink ?? 0}
              <span class="font-semibold">⚙️</span> {loot()?.gear ?? 0}
            </div>
            <Button class="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700" onClick={() => void spawnDeck("deck_organization")}>
              Organization
            </Button>
            <Button class="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700" onClick={() => setShowHelp(true)}>
              ?
            </Button>
          </div>
        </div>

        <Show when={err()}>
          <div class="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-200">{err()}</div>
        </Show>

        <div
          ref={boardEl}
          class="relative h-[72vh] w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40"
          onPointerMove={onPointerMoveBoard}
          onPointerUp={onPointerUpBoard}
        >
          {/* left sidebar */}
          <div class="absolute left-4 top-4 z-20 w-[280px] rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-slate-200">
            <div class="text-xs font-extrabold tracking-widest text-amber-200">TODAY'S GOALS</div>
            <div class="mt-3 rounded-md bg-emerald-950/40 px-3 py-2 text-sm">
              Danger: <span class="font-semibold">{today()?.danger_level ?? "—"}</span>
            </div>
            <div class="mt-3 text-sm text-slate-300">
              Villagers: {today()?.villagers_free ?? 0} free / {today()?.villagers_total ?? 0} total
            </div>
            <div class="mt-1 text-sm text-slate-300">
              Tasks: {today()?.tasks_live ?? 0} live • {today()?.tasks_completed_today ?? 0} completed today
            </div>
            <div class="mt-4 border-t border-slate-800 pt-3">
              <div class="text-xs font-bold tracking-widest text-slate-400">VILLAGER STAMINA</div>
              <For each={villagers()}>
                {(v) => (
                  <div class="mt-2 text-sm text-slate-200">
                    {v.name}: {v.stamina}/{v.max_stamina}
                  </div>
                )}
              </For>
            </div>
          </div>

          <Show when={loading()}>
            <div class="absolute inset-0 grid place-items-center text-slate-400">Loading board…</div>
          </Show>

          <For each={rootEntities()}>
            {(e) => {
              const x = e.x;
              const y = e.y;
              const stackId = e.stack_id;
              const stack = stackId ? stacksById()[stackId] : undefined;
              const attached = stack ? [...stack.attached_ids] : [];
              const taskId = stack?.task_id;

              // Build a render order: task first (front), then attached behind.
              const renderIds: string[] = [];
              if (taskId) renderIds.push(taskId);
              renderIds.push(...attached);
              const renderEntities = renderIds.length ? renderIds.map((id) => entitiesById()[id]).filter(Boolean) : [e];

              return (
                <div class="absolute" style={{ transform: `translate(${x}px, ${y}px)` }}>
                  <div class="relative">
                    <For each={renderEntities}>
                      {(ce, idx) => (
                        <div class="absolute" style={{ transform: `translate(0px, ${idx() * 22}px)` }}>
                          <div onPointerDown={(ev) => onPointerDownEntity(ev as unknown as PointerEvent, ce.id)}>
                            <LegacyCard
                            title={titleForEntity(ce)}
                            emoji={emojiForEntity(ce)}
                            name={nameForEntity(ce)}
                            subtitle={subtitleForEntity(ce)}
                            collapsed={idx() > 0}
                            showHandle={idx() === 0 && ce.kind === "card" && ce.card_type === "task" && !!stackId}
                            onUnstack={stackId ? () => void unstack(stackId) : undefined}
                            onInfo={() => {}}
                            onDone={undefined}
                            />
                          </div>
                        </div>
                      )}
                    </For>

                    <Show when={e.kind === "deck"}>
                      <button
                        class="absolute inset-0 h-[190px] w-[140px] rounded-xl"
                        onClick={() => void openDeck(e.id)}
                        title="Open deck"
                      />
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>

          {/* bottom fixed decks row */}
          <div class="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-end gap-6">
            <div ref={collectDeckEl}>
              <LegacyDeckCard variant="collect" title="Collect" subtitle="Drop Loot" />
            </div>
            <LegacyDeckCard variant="firstDay" title="First Day" footer="0 🪙" onClick={() => void spawnDeck("deck_first_day")} />
          </div>

          <Show when={showHelp()}>
            <div class="absolute inset-0 z-50 bg-black/60" onClick={() => setShowHelp(false)}>
              <div class="absolute bottom-6 right-6 max-h-[70vh] w-[360px] overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-slate-200" onClick={(e) => e.stopPropagation()}>
                <div class="text-sm font-extrabold">Donegeon Rules (v0.3)</div>
                <div class="mt-3 text-sm text-slate-300">
                  - Drag cards around. Drop loot onto the Collect deck.\n                  - Click First Day to spawn a deck, then click the spawned deck to open it.\n                  - Stack compatible cards by dropping onto another card.\n                  - Use the X on task stacks to unstack.\n                </div>
                <div class="mt-4">
                  <Button class="w-full rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700" onClick={() => setShowHelp(false)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </main>
  );
}

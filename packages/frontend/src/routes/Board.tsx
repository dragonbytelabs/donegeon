import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import { A } from "@solidjs/router";
import { Button } from "@kobalte/core/button";
import type { BoardEntityDto, BoardStateDto, StackDto } from "@donegeon/app/api";
import { createBoardStore } from "../state/boardStore";
import { LegacyCard } from "../board/legacy/Card";
import { LegacyDeckCard } from "../board/legacy/DeckCard";

export default function BoardRoute() {
  const [note] = createSignal("Board v0.4: camera + dock (in progress)");
  const store = createBoardStore();
  const st = () => store.state;
  const [showHelp, setShowHelp] = createSignal(false);

  let boardEl!: HTMLDivElement;
  let collectDeckEl!: HTMLDivElement;

  const CARD_W = 120;
  const CARD_H = 160;

  // Camera: infinite canvas
  const pan = createMemo(() => ({ x: st().camera.panX, y: st().camera.panY }));
  const zoom = createMemo(() => st().camera.zoom);

  const transform = createMemo(() => `translate(${pan().x}px, ${pan().y}px) scale(${zoom()})`);
  const bgPos = createMemo(() => `${Math.round(pan().x)}px ${Math.round(pan().y)}px`);

  function clamp(n: number, a: number, b: number) {
    return Math.max(a, Math.min(b, n));
  }

  function toWorld(clientX: number, clientY: number) {
    const rect = boardEl.getBoundingClientRect();
    const x = (clientX - rect.left - pan().x) / zoom();
    const y = (clientY - rect.top - pan().y) / zoom();
    return { x, y };
  }

  createEffect(() => {
    void store.actions.load();
  });

  const entitiesById = createMemo(() => {
    const b = st().board;
    const m: Record<string, BoardEntityDto> = {};
    if (!b) return m;
    for (const e of b.entities) m[e.id] = e;
    return m;
  });

  const stacksById = createMemo(() => {
    const b = st().board;
    const m: Record<string, StackDto> = {};
    if (!b) return m;
    for (const s of b.stacks) m[s.id] = s;
    return m;
  });

  const rootEntities = createMemo(() => {
    const b = st().board;
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

  const dockDecks = createMemo(() => {
    // Order for the dock: first_day, organization, maintenance, planning, integration, then anything else.
    const order = ["first_day", "organization", "maintenance", "planning", "integration"];
    const list = [...st().decks];
    list.sort((a, b) => {
      const ai = order.indexOf(a.type);
      const bi = order.indexOf(b.type);
      const ao = ai === -1 ? 999 : ai;
      const bo = bi === -1 ? 999 : bi;
      if (ao !== bo) return ao - bo;
      return a.name.localeCompare(b.name);
    });
    return list;
  });

  // Periodic reconcile (server wins). Only pull when user is idle.
  createEffect(() => {
    const t = setInterval(() => {
      if (draggingId() || isPanning()) return;
      void store.actions.pullBoardState();
    }, 3000);
    return () => clearInterval(t);
  });

  async function openDeck(deckEntityId: string) {
    await store.actions.openDeck(deckEntityId);
  }

  async function unstack(stackId: string) {
    await store.actions.unstack(stackId);
  }

  // Drag/drop (single entity for now; stacks are moved server-side when moving a stacked entity)
  const [draggingId, setDraggingId] = createSignal<string | null>(null);
  const [dragStart, setDragStart] = createSignal<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = createSignal<{ x: number; y: number } | null>(null);
  const [isPanning, setIsPanning] = createSignal(false);
  const [panPointer, setPanPointer] = createSignal<{ id: number; startX: number; startY: number; panX: number; panY: number } | null>(null);

  function onPointerDownBoard(ev: PointerEvent) {
    // Right mouse drag pans (infinite canvas)
    if (ev.button === 2) {
      setIsPanning(true);
      setPanPointer({ id: ev.pointerId, startX: ev.clientX, startY: ev.clientY, panX: pan().x, panY: pan().y });
      (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
      ev.preventDefault();
    }
  }

  function onPointerMovePan(ev: PointerEvent) {
    const pp = panPointer();
    if (!pp || !isPanning() || pp.id !== ev.pointerId) return;
    store.actions.setCamera({ panX: pp.panX + (ev.clientX - pp.startX), panY: pp.panY + (ev.clientY - pp.startY), zoom: zoom() });
  }

  function onPointerUpPan(ev: PointerEvent) {
    const pp = panPointer();
    if (!pp || pp.id !== ev.pointerId) return;
    setIsPanning(false);
    setPanPointer(null);
    try {
      (ev.currentTarget as HTMLElement).releasePointerCapture(ev.pointerId);
    } catch {
      // ignore
    }
  }

  function onWheelBoard(ev: WheelEvent) {
    ev.preventDefault();
    // Zoom around cursor
    const before = toWorld(ev.clientX, ev.clientY);
    const nextZoom = clamp(zoom() * (ev.deltaY > 0 ? 0.92 : 1.08), 0.35, 2.5);
    store.actions.setCamera({ panX: pan().x, panY: pan().y, zoom: nextZoom });
    const after = toWorld(ev.clientX, ev.clientY);
    // Adjust pan so the world point under cursor stays stable
    store.actions.setCamera({
      panX: pan().x + (after.x - before.x) * nextZoom,
      panY: pan().y + (after.y - before.y) * nextZoom,
      zoom: nextZoom
    });
  }

  function preventContextMenu(ev: MouseEvent) {
    ev.preventDefault();
  }

  function onPointerDownEntity(ev: PointerEvent, entityId: string) {
    if (ev.button !== 0) return;
    const b = st().board;
    if (!b) return;
    const ent = entitiesById()[entityId];
    if (!ent) return;
    const pt = toWorld(ev.clientX, ev.clientY);
    setDraggingId(entityId);
    setDragStart({ x: ent.x, y: ent.y });
    setDragOffset({ x: pt.x - ent.x, y: pt.y - ent.y });
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    ev.preventDefault();
  }

  async function onPointerMoveBoard(ev: PointerEvent) {
    if (isPanning()) {
      onPointerMovePan(ev);
      return;
    }
    const id = draggingId();
    const off = dragOffset();
    if (!id || !off) return;
    const b = st().board;
    if (!b) return;
    const ent = entitiesById()[id];
    if (!ent) return;
    const pt = toWorld(ev.clientX, ev.clientY);
    const x = pt.x - off.x;
    const y = pt.y - off.y;
    store.actions.optimisticMove(id, x, y);
  }

  async function onPointerUpBoard(ev: PointerEvent) {
    if (isPanning()) {
      onPointerUpPan(ev);
      return;
    }
    const id = draggingId();
    if (!id) return;
    setDraggingId(null);
    const b = st().board;
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
      // deckLocal is in screen px; convert to world coords
      const deckWorld = {
        left: (deckLocal.left - pan().x) / zoom(),
        right: (deckLocal.right - pan().x) / zoom(),
        top: (deckLocal.top - pan().y) / zoom(),
        bottom: (deckLocal.bottom - pan().y) / zoom()
      };
      const cx = ent.x + CARD_W / 2;
      const cy = ent.y + CARD_H / 2;
      const inCollectDeck = cx >= deckWorld.left && cx <= deckWorld.right && cy >= deckWorld.top && cy <= deckWorld.bottom;
      if (inCollectDeck) {
        await store.actions.collect(id);
        return;
      }
    }

    // Stack if dropped near another compatible card (very rough)
    const candidates = (b.entities ?? []).filter((e) => e.id !== id && e.kind === "card");
    const near = candidates.find((e) => Math.hypot(e.x - ent.x, e.y - ent.y) < 40);
    if (near) {
      try {
        await store.actions.stack(id, near.id);
        return;
      } catch {
        // fall through to move
      }
    }

    // Persist move
    await store.actions.persistMove(id, ent.x, ent.y);
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
              <span class="font-semibold">🪙</span> {st().loot?.coin ?? 0}
              <span class="font-semibold">📄</span> {st().loot?.paper ?? 0}
              <span class="font-semibold">🖋️</span> {st().loot?.ink ?? 0}
              <span class="font-semibold">⚙️</span> {st().loot?.gear ?? 0}
            </div>
            <Button class="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700" onClick={() => setShowHelp(true)}>
              ?
            </Button>
          </div>
        </div>

        <Show when={st().error}>
          <div class="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-200">{st().error}</div>
        </Show>

        <div
          ref={boardEl}
          class="relative h-[72vh] w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40"
          style={{
            "background-image":
              "radial-gradient(900px 600px at 30% 20%, rgba(130, 255, 200, 0.10), rgba(0, 0, 0, 0) 60%), radial-gradient(800px 500px at 70% 70%, rgba(120, 160, 255, 0.10), rgba(0, 0, 0, 0) 60%), linear-gradient(180deg, rgba(18, 18, 22, 1), rgba(10, 10, 14, 1)), linear-gradient(to right, rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.08) 1px, transparent 1px)",
            "background-size": "auto, auto, auto, 100px 100px, 100px 100px",
            "background-position": `0 0, 0 0, 0 0, ${bgPos()}, ${bgPos()}`
          }}
          onContextMenu={(e) => preventContextMenu(e as unknown as MouseEvent)}
          onPointerDown={(e) => onPointerDownBoard(e as unknown as PointerEvent)}
          onWheel={(e) => onWheelBoard(e as unknown as WheelEvent)}
          onPointerMove={onPointerMoveBoard}
          onPointerUp={onPointerUpBoard}
        >
          {/* left sidebar */}
          <div class="absolute left-4 top-4 z-20 w-[280px] rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-slate-200">
            <div class="text-xs font-extrabold tracking-widest text-amber-200">TODAY'S GOALS</div>
            <div class="mt-3 rounded-md bg-emerald-950/40 px-3 py-2 text-sm">
              Danger: <span class="font-semibold">{st().today?.danger_level ?? "—"}</span>
            </div>
            <div class="mt-3 text-sm text-slate-300">
              Villagers: {st().today?.villagers_free ?? 0} free / {st().today?.villagers_total ?? 0} total
            </div>
            <div class="mt-1 text-sm text-slate-300">
              Tasks: {st().today?.tasks_live ?? 0} live • {st().today?.tasks_completed_today ?? 0} completed today
            </div>
            <div class="mt-4 border-t border-slate-800 pt-3">
              <div class="text-xs font-bold tracking-widest text-slate-400">VILLAGER STAMINA</div>
              <For each={st().villagers}>
                {(v) => (
                  <div class="mt-2 text-sm text-slate-200">
                    {v.name}: {v.stamina}/{v.max_stamina}
                  </div>
                )}
              </For>
            </div>
          </div>

          <Show when={st().loading}>
            <div class="absolute inset-0 grid place-items-center text-slate-400">Loading board…</div>
          </Show>

          {/* world layer (camera transform) */}
          <div class="absolute inset-0 origin-top-left" style={{ transform: transform() }}>
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
                          class="absolute inset-0 h-[160px] w-[120px] rounded-xl"
                          onClick={() => void openDeck(e.id)}
                          title="Open deck"
                        />
                      </Show>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>

          {/* bottom fixed decks row */}
          <div class="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-end gap-4">
            <div ref={collectDeckEl}>
              <LegacyDeckCard variant="collect" title="Collect" subtitle="Drop Loot" />
            </div>
            <For each={dockDecks()}>
              {(d) => {
                const isLocked = d.status === "locked";
                const req = d.unlock_required_tasks ?? 0;
                const processed = d.world_tasks_processed ?? 0;
                const progressPct = req > 0 ? Math.min(100, Math.round((processed / req) * 100)) : 100;
                const isFree = d.type === "first_day" && d.times_opened < 5;
                const title = d.type === "organization" ? "Modifiers" : d.name.replace(" Deck", "");
                const footer = isFree ? "FREE" : `${d.base_cost} 🪙`;

                return (
                  <div class="relative">
                    <LegacyDeckCard
                      variant={d.type === "first_day" ? "firstDay" : "firstDay"}
                      title={title}
                      footer={footer}
                      onClick={() => {
                        if (isLocked) {
                          store.actions.showToast(`Locked: ${req} tasks (${processed}/${req})`);
                          return;
                        }
                        void store.actions.spawnDeck(d.id);
                      }}
                    />
                    <Show when={isLocked}>
                      <div class="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                        <div class="absolute inset-0 bg-black/40" />
                        <div class="absolute left-2 right-2 top-2 rounded-xl bg-black/40 px-2 py-1 text-center text-[11px] font-black text-white">
                          Locked
                        </div>
                        <div class="absolute bottom-2 left-2 right-2 rounded-xl bg-black/40 px-2 py-2">
                          <div class="h-2 w-full overflow-hidden rounded-full bg-white/15">
                            <div class="h-full bg-sky-400" style={{ width: `${progressPct}%` }} />
                          </div>
                          <div class="mt-1 text-center text-[10px] font-bold text-white/90">
                            {processed}/{req} tasks
                          </div>
                        </div>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>

          <Show when={st().toast}>
            <div class="absolute bottom-44 left-1/2 z-40 -translate-x-1/2 rounded-xl border border-slate-800 bg-slate-950/85 px-4 py-2 text-sm font-semibold text-slate-100 shadow-xl">
              {st().toast}
            </div>
          </Show>

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

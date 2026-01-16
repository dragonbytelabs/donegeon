import { For, Show, createEffect, createMemo, createSignal, onCleanup, batch } from "solid-js";
import { A } from "@solidjs/router";
import { Button } from "@kobalte/core/button";
import type { BoardEntityDto, BoardStateDto, StackDto } from "@donegeon/app/api";
import { createBoardStore } from "../state/boardStore";
import { LegacyCard } from "../board/legacy/Card";
import { LegacyDeckCard } from "../board/legacy/DeckCard";
import { Notifications } from "../components/Notifications";
import { notificationsActions } from "../state/notificationsStore";
import { SpawnDock } from "../components/SpawnDock";

// Helper functions defined outside component to avoid re-creation on every render
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

export default function BoardRoute() {
  const [note] = createSignal("Board v0.4: camera + dock (in progress)");
  const store = createBoardStore();
  const st = () => store.state;
  const [showHelp, setShowHelp] = createSignal(false);
  const [leftTab, setLeftTab] = createSignal<"quests" | "today">("quests");
  const [nowTick, setNowTick] = createSignal(0);

  createEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 200);
    onCleanup(() => clearInterval(t));
  });

  let boardEl!: HTMLDivElement;
  let collectDeckEl!: HTMLDivElement;
  let sellDeckEl!: HTMLDivElement;
  let trashDeckEl!: HTMLDivElement;

  const CARD_W = 120;
  const CARD_H = 160;

  const [boardSize, setBoardSize] = createSignal({ w: 1000, h: 600 });
  createEffect(() => {
    if (!boardEl) return;
    const ro = new ResizeObserver(() => {
      setBoardSize({ w: boardEl.clientWidth || 1000, h: boardEl.clientHeight || 600 });
    });
    ro.observe(boardEl);
    setBoardSize({ w: boardEl.clientWidth || 1000, h: boardEl.clientHeight || 600 });
    onCleanup(() => ro.disconnect());
  });

  // Camera: infinite canvas
  const pan = createMemo(() => ({ x: st().camera.panX, y: st().camera.panY }));
  const zoom = createMemo(() => st().camera.zoom);

  const transform = createMemo(() => `translate(${pan().x}px, ${pan().y}px) scale(${zoom()})`);
  const bgPos = createMemo(() => `${Math.round(pan().x)}px ${Math.round(pan().y)}px`);

  const minimapData = createMemo(() => {
    const b = st().board;
    if (!b || b.entities.length === 0) return null;

    // Cap minimap entity count for performance (render max 100 entities)
    const cappedEntities = b.entities.slice(0, 100);

    const xs = cappedEntities.map((e) => e.x);
    const ys = cappedEntities.map((e) => e.y);
    const minX = Math.min(...xs) - 200;
    const maxX = Math.max(...xs) + 200;
    const minY = Math.min(...ys) - 200;
    const maxY = Math.max(...ys) + 200;
    const worldW = Math.max(1, maxX - minX);
    const worldH = Math.max(1, maxY - minY);
    const mmW = 220;
    const mmH = 140;
    const scale = Math.min(mmW / worldW, mmH / worldH);

    const view = {
      left: (-pan().x) / zoom(),
      top: (-pan().y) / zoom(),
      right: (boardSize().w - pan().x) / zoom(),
      bottom: (boardSize().h - pan().y) / zoom()
    };

    return { minX, minY, worldW, worldH, mmW, mmH, scale, view, cappedEntities };
  });

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

  // Hotkeys (v0.7)
  createEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || (el as any)?.isContentEditable) return;

      if (e.key === "?") {
        setShowHelp(true);
        e.preventDefault();
        return;
      }
      if (e.key === "Escape") {
        setSelectedIds([]);
        setShowHelp(false);
        e.preventDefault();
        return;
      }
      if (e.key === "0") {
        store.actions.setCamera({ panX: pan().x, panY: pan().y, zoom: 1 });
        e.preventDefault();
        return;
      }
      if (e.key.toLowerCase() === "c") {
        store.actions.setCamera({ panX: boardSize().w / 2, panY: boardSize().h / 2, zoom: zoom() });
        e.preventDefault();
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
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
      void store.actions.pullQuests();
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
  const [dragGroup, setDragGroup] = createSignal<{
    ids: string[];
    startPt: { x: number; y: number };
    startPos: Record<string, { x: number; y: number }>;
  } | null>(null);

  const [selectedIds, setSelectedIds] = createSignal<string[]>([]);
  const selectedSet = createMemo(() => new Set(selectedIds()));
  const [isPanning, setIsPanning] = createSignal(false);
  const [panPointer, setPanPointer] = createSignal<{ id: number; startX: number; startY: number; panX: number; panY: number } | null>(null);
  const [hoverDock, setHoverDock] = createSignal<"collect" | "sell" | "trash" | null>(null);
  const [hoverStack, setHoverStack] = createSignal<{ id: string; allowed: boolean } | null>(null);
  const [panVel, setPanVel] = createSignal<{ vx: number; vy: number; t: number } | null>(null);
  let inertiaRaf: number | null = null;

  function onPointerDownBoard(ev: PointerEvent) {
    // Right mouse drag pans (infinite canvas)
    if (ev.button === 2) {
      setIsPanning(true);
      setPanPointer({ id: ev.pointerId, startX: ev.clientX, startY: ev.clientY, panX: pan().x, panY: pan().y });
      setPanVel({ vx: 0, vy: 0, t: performance.now() });
      if (inertiaRaf != null) {
        cancelAnimationFrame(inertiaRaf);
        inertiaRaf = null;
      }
      (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
      ev.preventDefault();
      return;
    }
    // Left-click empty area clears selection
    if (ev.button === 0) {
      const target = ev.target as HTMLElement | null;
      if (target && boardEl && target === boardEl) {
        setSelectedIds([]);
      }
    }
  }

  function onPointerMovePan(ev: PointerEvent) {
    const pp = panPointer();
    if (!pp || !isPanning() || pp.id !== ev.pointerId) return;
    const nx = pp.panX + (ev.clientX - pp.startX);
    const ny = pp.panY + (ev.clientY - pp.startY);
    const pv = panVel();
    const now = performance.now();
    if (pv) {
      const dt = Math.max(1, now - pv.t);
      setPanVel({ vx: ((nx - pan().x) / dt) * 16, vy: ((ny - pan().y) / dt) * 16, t: now }); // px per frame approx
    }
    store.actions.setCamera({ panX: nx, panY: ny, zoom: zoom() });
  }

  function onPointerUpPan(ev: PointerEvent) {
    const pp = panPointer();
    if (!pp || pp.id !== ev.pointerId) return;
    setIsPanning(false);
    setPanPointer(null);
    // Inertia pan (v0.6): decay velocity over time
    const startVel = panVel();
    if (startVel && (Math.abs(startVel.vx) > 0.8 || Math.abs(startVel.vy) > 0.8)) {
      let vx = startVel.vx;
      let vy = startVel.vy;
      const step = () => {
        vx *= 0.92;
        vy *= 0.92;
        if (Math.abs(vx) < 0.1 && Math.abs(vy) < 0.1) {
          inertiaRaf = null;
          return;
        }
        store.actions.setCamera({ panX: pan().x + vx, panY: pan().y + vy, zoom: zoom() });
        inertiaRaf = requestAnimationFrame(step);
      };
      inertiaRaf = requestAnimationFrame(step);
    }
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
    // Selection (v0.7): shift toggles, plain click selects single
    if (ev.shiftKey) {
      setSelectedIds((prev) => {
        const set = new Set(prev);
        if (set.has(entityId)) set.delete(entityId);
        else set.add(entityId);
        return [...set];
      });
    } else {
      if (!selectedSet().has(entityId) || selectedIds().length > 1) setSelectedIds([entityId]);
    }

    const pt = toWorld(ev.clientX, ev.clientY);
    const ids = selectedSet().has(entityId) ? selectedIds() : [entityId];
    if (ids.length > 1) {
      const startPos: Record<string, { x: number; y: number }> = {};
      for (const id of ids) {
        const e = entitiesById()[id];
        if (!e) continue;
        startPos[id] = { x: e.x, y: e.y };
      }
      setDragGroup({ ids, startPt: pt, startPos });
      setDraggingId(entityId);
      setDragStart({ x: ent.x, y: ent.y });
      setDragOffset(null);
    } else {
      setDragGroup(null);
      setDraggingId(entityId);
      setDragStart({ x: ent.x, y: ent.y });
      setDragOffset({ x: pt.x - ent.x, y: pt.y - ent.y });
    }
    // Capture on the board so drag/drop continues even when cursor leaves the play area (dock is outside).
    boardEl.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  }

  async function onPointerMoveBoard(ev: PointerEvent) {
    if (isPanning()) {
      onPointerMovePan(ev);
      return;
    }
    const id = draggingId();
    const grp = dragGroup();
    const off = dragOffset();
    if (!id || (!off && !grp)) {
      setHoverDock(null);
      return;
    }
    const b = st().board;
    if (!b) return;
    const ent = entitiesById()[id];
    if (!ent) return;
    const pt = toWorld(ev.clientX, ev.clientY);

    // Batch all state updates together to reduce re-renders during drag
    batch(() => {
      if (grp) {
        const dx = pt.x - grp.startPt.x;
        const dy = pt.y - grp.startPt.y;
        for (const gid of grp.ids) {
          const sp = grp.startPos[gid];
          if (!sp) continue;
          store.actions.optimisticMove(gid, sp.x + dx, sp.y + dy);
        }
        // group drag disables stack hover
        setHoverStack(null);
      } else if (off) {
        const x = pt.x - off.x;
        const y = pt.y - off.y;
        store.actions.optimisticMove(id, x, y);

        // Stack hover (world-space): show preview when near another compatible card.
        const candidates = (b.entities ?? []).filter((e) => e.id !== id && e.kind === "card");
        const near = candidates.find((e) => Math.hypot(e.x - x, e.y - y) < 46);
        if (near) {
          const sameType = (ent as any).card_type === (near as any).card_type;
          const aSub = (ent as any).subtype ?? "";
          const bSub = (near as any).subtype ?? "";
          const subtypeOk = (ent as any).card_type === "food" || (ent as any).card_type === "resource" ? aSub !== "" && aSub === bSub : true;
          setHoverStack({ id: near.id, allowed: sameType && subtypeOk });
        } else {
          setHoverStack(null);
        }
      }

      // Dock hover (client-space): highlight Collect/Sell/Trash slots when cursor is over them.
      const canCollect = ent.kind === "card" && ent.card_type === "loot";
      const canSell = ent.kind === "card" && ent.card_type !== "villager";
      const canTrash = ent.kind === "card" && ent.card_type !== "villager";
      let nextHover: "collect" | "sell" | "trash" | null = null;
      if (canCollect && collectDeckEl) {
        const r = collectDeckEl.getBoundingClientRect();
        if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) nextHover = "collect";
      }
      if (!nextHover && canSell && sellDeckEl) {
        const r = sellDeckEl.getBoundingClientRect();
        if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) nextHover = "sell";
      }
      if (!nextHover && canTrash && trashDeckEl) {
        const r = trashDeckEl.getBoundingClientRect();
        if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) nextHover = "trash";
      }
      setHoverDock(nextHover);
    });
  }

  async function onPointerUpBoard(ev: PointerEvent) {
    if (isPanning()) {
      onPointerUpPan(ev);
      return;
    }
    const id = draggingId();
    if (!id) return;
    setDraggingId(null);
    setHoverDock(null);
    const hs = hoverStack();
    setHoverStack(null);
    const grp = dragGroup();
    setDragGroup(null);
    const b = st().board;
    if (!b) return;
    const ent = entitiesById()[id];
    if (!ent) return;

    // Group drag: persist all moved entities; skip zone/stack behavior.
    if (grp && grp.ids.length > 1) {
      for (const gid of grp.ids) {
        const e = entitiesById()[gid];
        if (!e) continue;
        await store.actions.persistMove(gid, e.x, e.y);
      }
      return;
    }

    // Work loop MVP (v0.7): dropping a villager onto a task/resource starts work/gather timer.
    if (ent.kind === "card" && ent.card_type === "villager") {
      const candidates = (b.entities ?? []).filter((e) => e.id !== id && e.kind === "card" && (e.card_type === "task" || e.card_type === "resource"));
      const near = candidates.find((e) => Math.hypot(e.x - ent.x, e.y - ent.y) < 60);
      if (near) {
        await store.actions.startWork(ent.id, near.id);
        return;
      }
    }

    // Unified drop resolution (v0.7):
    // 1) dock zones (collect/sell/trash)
    // 2) stack preview target
    // 3) move
    if (hoverDock() === "collect") {
      await store.actions.collect(id);
      return;
    }
    if (hoverDock() === "sell") {
      await store.actions.sell(id);
      return;
    }
    if (hoverDock() === "trash") {
      await store.actions.trash(id);
      return;
    }
    if (hs?.id && hs.allowed) {
      try {
        await store.actions.stack(id, hs.id);
        return;
      } catch {
        // fall through to move
      }
    }
    if (hs?.id && !hs.allowed) {
      notificationsActions.pushInfo("Can't stack", "These cards aren't compatible.");
    }

    // No-overlap solver (v0.6 MVP): nudge away until we find a non-overlapping spot.
    function overlapsAny(x: number, y: number) {
      const pad = 6;
      const a = { l: x + pad, r: x + CARD_W - pad, t: y + pad, b: y + CARD_H - pad };
      for (const other of b?.entities ?? []) {
        if (other.id === id) continue;
        const o = { l: other.x + pad, r: other.x + CARD_W - pad, t: other.y + pad, b: other.y + CARD_H - pad };
        const hit = a.l < o.r && a.r > o.l && a.t < o.b && a.b > o.t;
        if (hit) return true;
      }
      return false;
    }

    let fx = ent.x;
    let fy = ent.y;
    if (overlapsAny(fx, fy)) {
      const step = 24;
      const tries = 160;
      for (let i = 1; i <= tries; i++) {
        // spiral-ish search around drop point
        const ring = Math.floor(Math.sqrt(i));
        const dx = ((i % (ring * 2 + 1)) - ring) * step;
        const dy = (ring - (Math.floor(i / (ring * 2 + 1)) % (ring * 2 + 1))) * step;
        const nx = ent.x + dx;
        const ny = ent.y + dy;
        if (!overlapsAny(nx, ny)) {
          fx = nx;
          fy = ny;
          break;
        }
      }
      store.actions.optimisticMove(id, fx, fy);
    }

    // Persist move
    await store.actions.persistMove(id, fx, fy);
  }


  return (
    <main class="relative h-screen overflow-hidden">
      {/* Floating header */}
      <div class="absolute left-0 right-0 top-0 z-50 flex items-center justify-between gap-4 bg-gradient-to-b from-slate-950 via-slate-950/90 to-transparent px-6 py-4">
        <div>
          <div class="text-xs font-semibold uppercase tracking-widest text-slate-400">Donegeon</div>
          <h1 class="text-2xl font-black tracking-tight">Board</h1>
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

      {/* Error notification */}
      <Show when={st().error}>
        <div class="absolute left-6 right-6 top-24 z-50 rounded-xl border border-red-900/50 bg-red-950/90 p-4 text-sm text-red-200 backdrop-blur-sm">{st().error}</div>
      </Show>

      {/* Full screen board */}
      <div
        ref={boardEl}
        class="relative h-screen w-full overflow-hidden bg-slate-950"
        onContextMenu={(e) => preventContextMenu(e as unknown as MouseEvent)}
        onPointerDown={(e) => onPointerDownBoard(e as unknown as PointerEvent)}
        onWheel={(e) => onWheelBoard(e as unknown as WheelEvent)}
        onPointerMove={onPointerMoveBoard}
        onPointerUp={onPointerUpBoard}
      >
        {/* background layer (clipped) */}
        <div
          class="absolute inset-0 overflow-hidden"
          style={{
            "background-image":
              "radial-gradient(900px 600px at 30% 20%, rgba(130, 255, 200, 0.10), rgba(0, 0, 0, 0) 60%), radial-gradient(800px 500px at 70% 70%, rgba(120, 160, 255, 0.10), rgba(0, 0, 0, 0) 60%), linear-gradient(180deg, rgba(18, 18, 22, 1), rgba(10, 10, 14, 1)), linear-gradient(to right, rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.08) 1px, transparent 1px)",
            "background-size": "auto, auto, auto, 100px 100px, 100px 100px",
            "background-position": `0 0, 0 0, 0 0, ${bgPos()}, ${bgPos()}`
          }}
        />
        {/* left sidebar */}
        <div class="absolute left-4 top-4 z-20 w-[280px] rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-slate-200">
          <div class="flex items-center justify-between">
            <div class="text-xs font-extrabold tracking-widest text-amber-200">{leftTab() === "quests" ? "QUESTS" : "TODAY"}</div>
            <div class="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/50 p-1 text-[11px]">
              <button
                class={["rounded-md px-2 py-1 font-extrabold", leftTab() === "quests" ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-900"].join(" ")}
                onClick={() => setLeftTab("quests")}
              >
                Quests
              </button>
              <button
                class={["rounded-md px-2 py-1 font-extrabold", leftTab() === "today" ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-900"].join(" ")}
                onClick={() => setLeftTab("today")}
              >
                Today
              </button>
            </div>
          </div>

          <Show when={leftTab() === "quests"}>
            <div class="mt-3 space-y-2">
              <For each={st().questsAll.filter((q) => q.type !== "daily")}>
                {(q) => (
                  <div class="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <div class="flex items-start justify-between gap-2">
                      <div>
                        <div class="text-sm font-extrabold text-slate-100">{q.title}</div>
                        <div class="mt-1 text-xs text-slate-300">{q.description}</div>
                      </div>
                      <Show when={q.status === "complete"}>
                        <button
                          class="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-black text-white hover:bg-emerald-500"
                          onClick={() => void store.actions.claimQuest(q.id)}
                        >
                          Claim
                        </button>
                      </Show>
                    </div>
                  </div>
                )}
              </For>

              <Show when={(st().questsAll.filter((q) => q.type !== "daily")?.length ?? 0) === 0}>
                <div class="text-sm text-slate-400">No active quests.</div>
              </Show>

              <div class="mt-3 border-t border-slate-800 pt-3">
                <div class="text-xs font-bold tracking-widest text-slate-400">DAILY</div>
                <For each={st().questsDaily}>
                  {(q) => (
                    <div class="mt-2 text-sm text-slate-200">
                      {q.title}
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          <Show when={leftTab() === "today"}>
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
          </Show>
        </div>

        <Show when={st().loading}>
          <div class="absolute inset-0 grid place-items-center text-slate-400">Loading board…</div>
        </Show>

        {/* pan/zoom hint */}
        <div class="absolute right-4 top-4 z-30 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-200">
          Right-drag to pan • Wheel to zoom
        </div>

        {/* minimap (v0.6) */}
        <Show when={minimapData()}>
          {(mm) => (
            <div
              class="absolute bottom-4 left-4 z-40 rounded-xl border border-slate-800 bg-slate-950/90 p-3 text-xs text-slate-200 backdrop-blur-sm"
              style={{ width: `${mm().mmW + 16}px` }}
            >
              <div class="mb-2 text-[11px] font-extrabold tracking-widest text-slate-300">MINIMAP</div>
              <div
                class="relative overflow-hidden rounded-lg border border-slate-800 bg-black/20"
                style={{ width: `${mm().mmW}px`, height: `${mm().mmH}px` }}
                onClick={(e) => {
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const mx = e.clientX - rect.left;
                  const my = e.clientY - rect.top;
                  const wx = mm().minX + mx / mm().scale;
                  const wy = mm().minY + my / mm().scale;
                  // center camera on clicked world point
                  store.actions.setCamera({
                    panX: boardSize().w / 2 - wx * zoom(),
                    panY: boardSize().h / 2 - wy * zoom(),
                    zoom: zoom()
                  });
                }}
                title="Click to pan"
              >
                <For each={mm().cappedEntities}>
                  {(e) => {
                    const x = (e.x - mm().minX) * mm().scale;
                    const y = (e.y - mm().minY) * mm().scale;
                    const color =
                      e.kind === "deck"
                        ? "bg-indigo-300"
                        : e.card_type === "task"
                          ? "bg-sky-300"
                          : e.card_type === "villager"
                            ? "bg-emerald-300"
                            : e.card_type === "loot"
                              ? "bg-amber-300"
                              : e.card_type === "modifier"
                                ? "bg-violet-300"
                                : "bg-slate-300";
                    const size = e.kind === "deck" ? 2.5 : 1.5;
                    return <div class={`absolute rounded-full ${color}`} style={{ left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px` }} />;
                  }}
                </For>

                {/* viewport rectangle */}
                <div
                  class="absolute rounded border border-amber-300/80 bg-amber-300/10"
                  style={{
                    left: `${(mm().view.left - mm().minX) * mm().scale}px`,
                    top: `${(mm().view.top - mm().minY) * mm().scale}px`,
                    width: `${(mm().view.right - mm().view.left) * mm().scale}px`,
                    height: `${(mm().view.bottom - mm().view.top) * mm().scale}px`
                  }}
                />
              </div>
            </div>
          )}
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
                <div
                  class={[
                    "absolute",
                    selectedSet().has(e.id) ? "outline outline-2 outline-amber-300/80 rounded-xl" : "",
                    hoverStack()?.id === e.id
                      ? hoverStack()?.allowed
                        ? "ring-2 ring-sky-300 ring-offset-2 ring-offset-slate-950/40 rounded-xl"
                        : "ring-2 ring-rose-300 ring-offset-2 ring-offset-slate-950/40 rounded-xl"
                      : ""
                  ].join(" ")}
                  style={{ transform: `translate(${x}px, ${y}px)` }}
                >
                  <div class="relative">
                    <For each={renderEntities}>
                      {(ce, idx) => (
                        <div class="absolute" style={{ transform: `translate(0px, ${idx() * 22}px)` }}>
                          <div onPointerDown={(ev) => onPointerDownEntity(ev as unknown as PointerEvent, ce.id)}>
                            <div
                              style={{
                                transform: `translate(${st().animOffsets[ce.id]?.dx ?? 0}px, ${st().animOffsets[ce.id]?.dy ?? 0}px)`,
                                transition: "transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1)"
                              }}
                            >
                              <LegacyCard
                                title={titleForEntity(ce)}
                                emoji={emojiForEntity(ce)}
                                name={nameForEntity(ce)}
                                subtitle={subtitleForEntity(ce)}
                                active={ce.kind === "card" && ce.card_type === "villager" && !!(ce as any).payload?.working_on}
                                progress={
                                  (() => {
                                    nowTick(); // re-evaluate
                                    const timer = (ce as any).timer as { started_at: string; duration_ms: number } | undefined;
                                    if (timer?.started_at && timer?.duration_ms) {
                                      const start = Date.parse(timer.started_at);
                                      const p = (Date.now() - start) / timer.duration_ms;
                                      return Math.max(0, Math.min(1, p));
                                    }
                                    if (ce.kind === "card" && ce.card_type === "task") {
                                      return Number((ce as any).payload?.task?.work_progress ?? (ce as any).payload?.work_progress);
                                    }
                                    return undefined;
                                  })()
                                }
                                collapsed={idx() > 0}
                                showHandle={idx() === 0 && ce.kind === "card" && ce.card_type === "task" && !!stackId}
                                onUnstack={stackId ? () => void unstack(stackId) : undefined}
                                onInfo={() => { }}
                                onDone={undefined}
                              />
                            </div>
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

        {/* SpawnDock inside play area */}
        <SpawnDock
          collectDeckRef={(el) => collectDeckEl = el}
          sellDeckRef={(el) => sellDeckEl = el}
          trashDeckRef={(el) => trashDeckEl = el}
          hoverDock={hoverDock()}
          dockDecks={dockDecks()}
          onSpawnDeck={(deckId) => void store.actions.spawnDeck(deckId)}
        />
      </div>

      <Notifications />
    </main>
  );
}

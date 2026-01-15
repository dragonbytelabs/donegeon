import { For, createMemo, createSignal, onCleanup } from "solid-js";

export type Vec2 = { x: number; y: number };

export type BoardEntity = {
  id: string;
  kind: "deck" | "card";
  pos: Vec2;
  label: string;
  accent?: "indigo" | "emerald" | "amber" | "red";
  isDragging?: boolean;
  pulseInvalid?: boolean;
};

export type BoardSurfaceProps = {
  entities: BoardEntity[];
  onEntityPointerDown?: (e: PointerEvent, entityId: string) => void;
  onReady?: (api: { toWorld: (client: Vec2) => Vec2 }) => void;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function BoardSurface(props: BoardSurfaceProps) {
  const [pan, setPan] = createSignal<Vec2>({ x: 0, y: 0 });
  const [zoom, setZoom] = createSignal(1);

  let container!: HTMLDivElement;

  const transform = createMemo(() => `translate(${pan().x}px, ${pan().y}px) scale(${zoom()})`);
  const toWorld = (client: Vec2): Vec2 => {
    const rect = container.getBoundingClientRect();
    const x = (client.x - rect.left - pan().x) / zoom();
    const y = (client.y - rect.top - pan().y) / zoom();
    return { x, y };
  };
  props.onReady?.({ toWorld });

  function onWheel(ev: WheelEvent) {
    ev.preventDefault();
    const next = clamp(zoom() * (ev.deltaY > 0 ? 0.92 : 1.08), 0.35, 2.5);
    setZoom(next);
  }

  // Pan with middle mouse or space+drag would be better; for v0.2 just right-click drag pan.
  let isPanning = false;
  let panStart: Vec2 | null = null;
  let pointerStart: Vec2 | null = null;

  function onPointerDown(ev: PointerEvent) {
    if (ev.button === 2) {
      isPanning = true;
      panStart = pan();
      pointerStart = { x: ev.clientX, y: ev.clientY };
      container.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    }
  }

  function onPointerMove(ev: PointerEvent) {
    if (!isPanning || !panStart || !pointerStart) return;
    setPan({ x: panStart.x + (ev.clientX - pointerStart.x), y: panStart.y + (ev.clientY - pointerStart.y) });
  }

  function onPointerUp(ev: PointerEvent) {
    if (isPanning) {
      isPanning = false;
      panStart = null;
      pointerStart = null;
      try {
        container.releasePointerCapture(ev.pointerId);
      } catch {
        // ignore
      }
    }
  }

  function preventContextMenu(ev: MouseEvent) {
    ev.preventDefault();
  }

  container?.addEventListener?.("contextmenu", preventContextMenu);
  onCleanup(() => {
    container?.removeEventListener?.("contextmenu", preventContextMenu);
  });

  return (
    <div
      ref={container}
      class="relative h-[70vh] w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div class="absolute left-3 top-3 z-20 rounded-md bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
        <div>Zoom: {zoom().toFixed(2)}</div>
        <div>Pan: {Math.round(pan().x)}, {Math.round(pan().y)}</div>
        <div class="text-slate-500">Right-drag to pan. Wheel to zoom.</div>
      </div>

      {/* world */}
      <div class="absolute inset-0 origin-center" style={{ transform: transform() }}>
        {/* grid */}
        <div
          class="absolute inset-[-2000px] opacity-30"
          style={{
            "background-image":
              "linear-gradient(to right, rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.12) 1px, transparent 1px)",
            "background-size": "100px 100px"
          }}
        />

        <For each={props.entities}>
          {(ent) => (
            <div
              class="absolute"
              style={{ transform: `translate(${ent.pos.x}px, ${ent.pos.y}px)` }}
            >
              <div
                class={[
                  "select-none rounded-lg border px-4 py-3 text-sm font-semibold shadow-sm",
                  "cursor-grab active:cursor-grabbing",
                  "transition-transform duration-150",
                  ent.pulseInvalid ? "animate-pulse" : "",
                  ent.accent === "indigo"
                    ? "border-indigo-700/60 bg-indigo-950/40 text-indigo-100"
                    : ent.accent === "emerald"
                      ? "border-emerald-700/60 bg-emerald-950/40 text-emerald-100"
                      : ent.accent === "amber"
                        ? "border-amber-700/60 bg-amber-950/40 text-amber-100"
                        : ent.accent === "red"
                          ? "border-red-700/60 bg-red-950/40 text-red-100"
                          : "border-slate-700/60 bg-slate-900/50 text-slate-100"
                ].join(" ")}
                onPointerDown={(ev) => props.onEntityPointerDown?.(ev as unknown as PointerEvent, ent.id)}
              >
                {ent.label}
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}


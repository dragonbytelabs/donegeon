import { Show } from "solid-js";

export type CardAccent = "purple" | "yellow" | "green" | "blue" | "gray";

export type LegacyCardProps = {
  title: string;
  emoji: string;
  name: string;
  subtitle?: string;
  accent?: CardAccent;
  active?: boolean; // green border when working/assigned
  showHandle?: boolean; // task card
  onUnstack?: () => void;
  onInfo?: () => void;
  onDone?: () => void;
  collapsed?: boolean; // for stacked behind cards: show only title strip
};

export function LegacyCard(props: LegacyCardProps) {
  const accent =
    props.accent === "purple"
      ? "border-purple-400/60"
      : props.accent === "yellow"
        ? "border-yellow-300/70"
        : props.accent === "green"
          ? "border-emerald-300/70"
          : props.accent === "blue"
            ? "border-sky-300/70"
            : "border-slate-400/40";

  return (
    <div
      class={[
        "relative w-[140px] select-none overflow-hidden rounded-xl border bg-white/90 text-slate-900 shadow-lg",
        accent,
        props.active ? "ring-2 ring-emerald-400" : "",
        props.collapsed ? "h-[44px]" : "h-[190px]"
      ].join(" ")}
    >
      {/* handle + unstack (task-only) */}
      <Show when={props.showHandle && !props.collapsed}>
        <div class="absolute left-[-18px] top-[52px] flex flex-col items-center gap-2">
          <div class="h-[86px] w-[16px] rounded-l-lg bg-slate-200/50 shadow-inner" />
          <button
            class="h-6 w-6 rounded-full bg-slate-200/70 text-xs font-black text-slate-700 hover:bg-slate-200"
            onClick={() => props.onUnstack?.()}
            title="Unstack"
          >
            ×
          </button>
        </div>
      </Show>

      {/* header */}
      <div class="flex items-center justify-between px-3 py-2">
        <div class="text-[11px] font-extrabold tracking-widest text-slate-700">{props.title}</div>
        <Show when={props.onInfo && !props.collapsed}>
          <button
            class="grid h-6 w-6 place-items-center rounded-md bg-slate-200/70 text-xs font-bold text-slate-700 hover:bg-slate-200"
            onClick={() => props.onInfo?.()}
            title="Details"
          >
            i
          </button>
        </Show>
      </div>

      <Show when={props.collapsed}>
        <div class="px-3 pb-2 text-[11px] font-semibold text-slate-600">{props.name}</div>
      </Show>

      <Show when={!props.collapsed}>
        <div class="flex flex-col items-center justify-center gap-2 px-3 pt-2">
          <div class="text-5xl leading-none">{props.emoji}</div>
          <div class="text-sm font-black tracking-tight">{props.name}</div>
          <Show when={props.subtitle}>
            <div class="text-xs font-semibold text-slate-600">{props.subtitle}</div>
          </Show>
        </div>

        <Show when={props.onDone}>
          <div class="absolute bottom-3 left-3 right-3">
            <button
              class="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-extrabold text-white hover:bg-emerald-500"
              onClick={() => props.onDone?.()}
            >
              Done
            </button>
          </div>
        </Show>
      </Show>
    </div>
  );
}


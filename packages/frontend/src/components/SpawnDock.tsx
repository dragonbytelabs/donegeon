import { For, Show } from "solid-js";
import { LegacyDeckCard } from "../board/legacy/DeckCard";
import { notificationsActions } from "../state/notificationsStore";
import type { DeckDto } from "@donegeon/app/api";

interface SpawnDockProps {
  collectDeckRef: (el: HTMLDivElement) => void;
  sellDeckRef: (el: HTMLDivElement) => void;
  trashDeckRef: (el: HTMLDivElement) => void;
  hoverDock: "collect" | "sell" | "trash" | null;
  dockDecks: DeckDto[];
  onSpawnDeck: (deckId: string) => void;
}

export function SpawnDock(props: SpawnDockProps) {
  return (
    <div class="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-end justify-center gap-4 rounded-xl border border-slate-800 bg-slate-950/90 px-4 py-4 backdrop-blur-sm">
      <div ref={props.collectDeckRef} class={props.hoverDock === "collect" ? "rounded-2xl ring-2 ring-emerald-300" : ""}>
        <LegacyDeckCard size="dock" variant="collect" title="Collect" subtitle="Drop Loot" />
      </div>
      <div ref={props.sellDeckRef} class={props.hoverDock === "sell" ? "rounded-2xl ring-2 ring-slate-200" : ""}>
        <LegacyDeckCard size="dock" variant="sell" title="Sell" subtitle="+🪙" />
      </div>
      <div ref={props.trashDeckRef} class={props.hoverDock === "trash" ? "rounded-2xl ring-2 ring-rose-300" : ""}>
        <LegacyDeckCard size="dock" variant="sell" title="Trash" subtitle="🗑️" />
      </div>
      <For each={props.dockDecks}>
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
                size="dock"
                variant={d.type === "first_day" ? "firstDay" : "firstDay"}
                title={title}
                footer={footer}
                onClick={() => {
                  if (isLocked) {
                    notificationsActions.pushInfo("Locked", `${processed}/${req} tasks processed`);
                    return;
                  }
                  props.onSpawnDeck(d.id);
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
  );
}

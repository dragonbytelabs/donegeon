import { For, Show } from "solid-js";
import { notificationsActions, notificationsState } from "../state/notificationsStore";

function accent(kind: string) {
  if (kind === "success") return "border-emerald-500/40 bg-emerald-950/40";
  if (kind === "warning") return "border-amber-400/40 bg-amber-950/35";
  if (kind === "error") return "border-red-500/40 bg-red-950/40";
  return "border-slate-700/60 bg-slate-950/60";
}

export function Notifications() {
  return (
    <div class="pointer-events-none fixed bottom-4 right-4 z-[999] flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-3">
      <For each={notificationsState.items}>
        {(n) => (
          <div
            class={[
              "pointer-events-auto rounded-xl border px-4 py-3 shadow-2xl backdrop-blur",
              "animate-[toastIn_180ms_ease-out]",
              accent(n.kind)
            ].join(" ")}
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-extrabold text-slate-100">{n.title}</div>
                <Show when={n.message}>
                  <div class="mt-1 text-sm text-slate-200/90">{n.message}</div>
                </Show>
              </div>
              <button
                class="rounded-md bg-white/10 px-2 py-1 text-xs font-black text-white hover:bg-white/15"
                onClick={() => notificationsActions.dismiss(n.id)}
                title="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </For>
      {/* local keyframes */}
      <style>
        {`
@keyframes toastIn {
  from { transform: translateY(8px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
        `}
      </style>
    </div>
  );
}


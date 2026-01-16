import { createStore, produce } from "solid-js/store";
import type { BoardEventDto } from "@donegeon/app/api";

export type NotificationKind = "info" | "success" | "warning" | "error";

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  message?: string;
  createdAt: number;
  ttlMs: number;
};

function genId() {
  return `n_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const [state, setState] = createStore<{ items: NotificationItem[] }>({ items: [] });

function push(n: Omit<NotificationItem, "id" | "createdAt">) {
  const id = genId();
  const createdAt = Date.now();
  const item: NotificationItem = { id, createdAt, ...n };

  setState(
    produce((s) => {
      s.items.unshift(item);
      // cap to avoid runaway
      s.items = s.items.slice(0, 6);
    })
  );

  setTimeout(() => dismiss(id), item.ttlMs);
}

function dismiss(id: string) {
  setState(
    produce((s) => {
      s.items = s.items.filter((x) => x.id !== id);
    })
  );
}

function pushError(message: string) {
  push({ kind: "error", title: "Error", message, ttlMs: 3500 });
}

function pushInfo(title: string, message?: string) {
  push({ kind: "info", title, message, ttlMs: 2500 });
}

function pushFromBoardEvents(events: BoardEventDto[]) {
  for (const e of events) {
    if (e.kind === "deck_open_fanout") {
      push({ kind: "success", title: "Deck opened", message: "Cards fanned out onto the board.", ttlMs: 2500 });
      continue;
    }
    if (e.kind === "collected") {
      push({ kind: "success", title: "Collected", message: "Loot added to inventory.", ttlMs: 2200 });
      continue;
    }
    if (e.kind === "stacked") {
      push({ kind: "info", title: "Stacked", message: "Cards stacked together.", ttlMs: 1800 });
      continue;
    }
    if (e.kind === "unstacked") {
      push({ kind: "info", title: "Unstacked", message: "Stack split apart.", ttlMs: 1800 });
      continue;
    }
    if (e.kind === "sold") {
      push({ kind: "success", title: "Sold", message: `+${e.loot_amount} ${e.loot_type}`, ttlMs: 2200 });
      continue;
    }
    if (e.kind === "trashed") {
      push({ kind: "info", title: "Trashed", message: "Card removed.", ttlMs: 1800 });
      continue;
    }
    if (e.kind === "quest_completed") {
      push({ kind: "success", title: "Quest completed!", message: e.title, ttlMs: 3200 });
      continue;
    }
    if (e.kind === "timer_started") {
      push({ kind: "info", title: "Working...", message: e.timer.kind === "work" ? "Task started" : "Gather started", ttlMs: 1500 });
      continue;
    }
    if (e.kind === "timer_completed") {
      push({ kind: "success", title: "Done!", message: "Reward spawned.", ttlMs: 2200 });
      continue;
    }
  }
}

export const notificationsState = state;
export const notificationsActions = {
  push,
  dismiss,
  pushError,
  pushInfo,
  pushFromBoardEvents
};


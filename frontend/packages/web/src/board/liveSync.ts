import type { Engine } from "@donegeon/core";

function collectLiveTaskIdsFromBoard(engine: Engine): string[] {
  const set = new Set<string>();

  for (const [, s] of engine.stacks) {
    const cards = s.cards[0]();
    for (const c of cards as any[]) {
      if (c?.def?.kind !== "task") continue;
      const id = c?.data?.taskId;
      if (typeof id !== "string" || !id) continue;

      // board shows only not-done tasks; if card knows it's done, skip it
      if (c?.data?.done === true) continue;

      set.add(id);
    }
  }

  return [...set];
}

async function apiSyncLive(taskIds: string[]) {
  const res = await fetch("/api/tasks/live", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskIds }),
  });
  if (!res.ok) throw new Error(`PUT /api/tasks/live failed: ${res.status}`);
}

// Debounce so drags/merges/splits don’t spam server
let liveSyncTimer: number | null = null;

export function scheduleLiveSync(engine: Engine, delayMs = 150) {
  if (liveSyncTimer != null) window.clearTimeout(liveSyncTimer);

  liveSyncTimer = window.setTimeout(async () => {
    liveSyncTimer = null;
    try {
      const ids = collectLiveTaskIdsFromBoard(engine);
      await apiSyncLive(ids);
    } catch (e) {
      console.warn("live sync failed", e);
    }
  }, delayMs);
}

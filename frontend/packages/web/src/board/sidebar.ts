import { createEffect } from "@donegeon/core";
import type { Engine } from "@donegeon/core";
import type { DonegeonDefId } from "../model/catalog";
import { clientToBoard } from "./geom.dom";
import { getPan } from "./pan";
import { cmdCardSpawn, reloadBoard } from "./api";

type TaskDTO = {
  done: boolean;
  updatedAt?: string;
  assignedVillagerId?: string;
};

type PlayerStateDTO = {
  villagerStamina?: Record<string, number>;
};

type VillagerSnapshot = {
  stackId: string;
  name: string;
};

type BoardSnapshot = {
  villagers: VillagerSnapshot[];
  zombieCount: number;
  boardTaskCount: number;
  assignedTaskCount: number;
  openedDeckCards: number;
};

const DEFAULT_VILLAGER_MAX_STAMINA = 6;
const REMOTE_REFRESH_MS = 10000;

function qs<T extends Element>(sel: string) {
  return document.querySelector(sel) as T | null;
}

function allGoalNodes(key: string): HTMLElement[] {
  return Array.from(document.querySelectorAll(`[data-goal="${key}"]`)) as HTMLElement[];
}

function setGoalText(key: string, text: string) {
  for (const el of allGoalNodes(key)) {
    el.textContent = text;
  }
}

function setDangerBadge(zombieCount: number) {
  const nodes = allGoalNodes("danger-badge");
  let label = "SAFE";
  let badgeClass = "bg-green-500/20";
  let textClass = "text-green-400";
  if (zombieCount > 2) {
    label = "DANGER";
    badgeClass = "bg-red-500/20";
    textClass = "text-red-400";
  } else if (zombieCount > 0) {
    label = "CAUTION";
    badgeClass = "bg-amber-500/20";
    textClass = "text-amber-300";
  }

  for (const el of nodes) {
    el.textContent = label;
    el.classList.remove(
      "bg-green-500/20",
      "bg-amber-500/20",
      "bg-red-500/20",
      "text-green-400",
      "text-amber-300",
      "text-red-400"
    );
    el.classList.add(badgeClass, textClass);
  }
}

function isTodayLocal(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function makeChecklistRow(label: string, done: boolean): HTMLElement {
  const row = document.createElement("div");
  row.className = "flex items-center gap-2 text-xs";

  const icon = document.createElement("span");
  icon.textContent = done ? "✓" : "○";
  icon.className = done ? "text-green-400" : "text-zinc-600";

  const text = document.createElement("span");
  text.textContent = label;
  text.className = done ? "text-zinc-300" : "text-zinc-500";

  row.append(icon, text);
  return row;
}

function renderChecklist(
  assignedTasks: number,
  staminaSpentWell: boolean,
  completedToday: number,
  openedDeckCards: number,
  zombiesCleared: boolean
) {
  const containers = allGoalNodes("success-checklist");
  for (const el of containers) {
    el.innerHTML = "";
    el.append(
      makeChecklistRow("Assign tasks to villagers", assignedTasks > 0),
      makeChecklistRow("Use stamina efficiently", staminaSpentWell),
      makeChecklistRow("Complete tasks today", completedToday > 0),
      makeChecklistRow("Open decks for new cards", openedDeckCards > 0),
      makeChecklistRow("Clear zombies before end of day", zombiesCleared)
    );
  }
}

function renderVillagerStamina(villagers: VillagerSnapshot[], staminaByVillager: Record<string, number>) {
  const containers = allGoalNodes("villager-stamina-list");
  for (const el of containers) {
    el.innerHTML = "";
    if (villagers.length === 0) {
      const empty = document.createElement("div");
      empty.className = "text-zinc-500";
      empty.textContent = "No villagers deployed";
      el.appendChild(empty);
      continue;
    }

    villagers.forEach((v, idx) => {
      const row = document.createElement("div");
      row.className = "text-zinc-400";

      const label = document.createElement("span");
      label.textContent = `${v.name || `Villager ${idx + 1}`}: `;

      const value = document.createElement("span");
      const stamina = staminaByVillager[v.stackId] ?? DEFAULT_VILLAGER_MAX_STAMINA;
      value.className = "text-zinc-200";
      value.textContent = `${stamina}/${DEFAULT_VILLAGER_MAX_STAMINA} stamina`;

      row.append(label, value);
      el.appendChild(row);
    });
  }
}

function renderActiveTasks(activeCount: number, completedToday: number) {
  const containers = allGoalNodes("active-tasks-list");
  for (const el of containers) {
    el.innerHTML = "";

    const active = document.createElement("div");
    active.className = "text-zinc-400";
    active.textContent = `${activeCount} active task${activeCount === 1 ? "" : "s"}`;
    el.appendChild(active);

    const done = document.createElement("div");
    done.className = "flex items-center gap-2";
    const icon = document.createElement("span");
    icon.className = completedToday > 0 ? "text-green-400" : "text-zinc-600";
    icon.textContent = completedToday > 0 ? "✓" : "○";
    const text = document.createElement("span");
    text.className = completedToday > 0 ? "text-zinc-300" : "text-zinc-500";
    text.textContent = `${completedToday} completed today`;
    done.append(icon, text);
    el.appendChild(done);
  }
}

function collectBoardSnapshot(engine: Engine): BoardSnapshot {
  const stackIds = engine.stackIds[0]();

  const villagers: VillagerSnapshot[] = [];
  let zombieCount = 0;
  let boardTaskCount = 0;
  let assignedTaskCount = 0;
  let openedDeckCards = 0;

  for (const stackId of stackIds) {
    const stack = engine.getStack(stackId);
    if (!stack) continue;
    const cards = stack.cards?.[0]?.() ?? [];
    if (cards.length === 0) continue;

    let villagerSeenOnStack = false;
    for (const card of cards as any[]) {
      const defId = String(card?.def?.id ?? "");
      const kind = String(card?.def?.kind ?? "");

      if (kind === "villager" && !villagerSeenOnStack) {
        villagerSeenOnStack = true;
        const villagerName =
          String(card?.data?.name ?? "").trim() ||
          String(card?.data?.villager_id ?? "").trim() ||
          `Villager ${villagers.length + 1}`;
        villagers.push({ stackId, name: villagerName });
      }
      if (kind === "zombie") zombieCount += 1;
      if (kind === "task") {
        boardTaskCount += 1;
        if (String(card?.data?.assignedVillagerId ?? "").trim() !== "") {
          assignedTaskCount += 1;
        }
      }

      const isSeedCard = defId.startsWith("deck.") || defId === "villager.basic";
      if (!isSeedCard) openedDeckCards += 1;
    }
  }

  return {
    villagers,
    zombieCount,
    boardTaskCount,
    assignedTaskCount,
    openedDeckCards,
  };
}

async function fetchTasksAll(): Promise<TaskDTO[]> {
  const res = await fetch("/api/tasks?status=all");
  if (!res.ok) throw new Error(`GET /api/tasks failed: ${res.status}`);
  return (await res.json()) as TaskDTO[];
}

async function fetchPlayerState(): Promise<PlayerStateDTO> {
  const res = await fetch("/api/player/state");
  if (!res.ok) throw new Error(`GET /api/player/state failed: ${res.status}`);
  return (await res.json()) as PlayerStateDTO;
}

export function initShell(engine: Engine, boardRoot: HTMLElement) {
  const sidebarToggle = qs<HTMLButtonElement>("#sidebarToggle");
  const sidebar = qs<HTMLElement>("#sidebar");
  const backdrop = qs<HTMLElement>("#sidebarBackdrop");

  function isSidebarOpen() {
    return !sidebar?.classList.contains("-translate-x-full");
  }

  function closeSidebar() {
    sidebar?.classList.add("-translate-x-full");
    backdrop?.classList.add("hidden");
  }

  function toggleSidebar() {
    if (isSidebarOpen()) closeSidebar();
    else {
      sidebar?.classList.remove("-translate-x-full");
      backdrop?.classList.remove("hidden");
    }
  }

  sidebarToggle?.addEventListener("click", toggleSidebar);
  backdrop?.addEventListener("click", closeSidebar);

  if (sidebar) {
    sidebar.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const btn = t.closest("button[data-spawn]") as HTMLButtonElement | null;
      if (!btn) return;

      const defId = btn.dataset.spawn as DonegeonDefId | undefined;
      if (!defId) return;

      const br = boardRoot.getBoundingClientRect();
      const cx = br.left + br.width * 0.55;
      const cy = br.top + br.height * 0.35;

      const pan = getPan();
      const p = clientToBoard(cx, cy, boardRoot, pan);

      void cmdCardSpawn(defId, p.x, p.y)
        .then(() => reloadBoard(engine))
        .catch((err) => {
          console.warn("sidebar spawn sync failed", err);
          void reloadBoard(engine).catch(() => {});
        });
      if (window.matchMedia("(max-width: 768px)").matches) closeSidebar();
    });
  }

  let boardSnapshot: BoardSnapshot = collectBoardSnapshot(engine);
  let tasks: TaskDTO[] = [];
  let villagerStamina: Record<string, number> = {};
  let remoteRefreshPending = false;

  const renderGoals = () => {
    const activeTasks = tasks.filter((t) => !t.done).length;
    const completedToday = tasks.filter((t) => t.done && isTodayLocal(t.updatedAt)).length;
    const assignedTasksTotal =
      boardSnapshot.assignedTaskCount + tasks.filter((t) => !t.done && !!t.assignedVillagerId).length;
    const villagersLive = boardSnapshot.villagers.filter((v) => {
      const stamina = villagerStamina[v.stackId];
      return stamina == null || stamina > 0;
    }).length;

    setDangerBadge(boardSnapshot.zombieCount);
    setGoalText("villager-count", `${villagersLive} live / ${boardSnapshot.villagers.length} total`);
    setGoalText("task-count", `${activeTasks} active + ${completedToday} completed today`);

    renderVillagerStamina(boardSnapshot.villagers, villagerStamina);
    renderActiveTasks(activeTasks, completedToday);

    const staminaSpentWell = boardSnapshot.villagers.some((v) => {
      const stamina = villagerStamina[v.stackId];
      return stamina != null && stamina > 0 && stamina < DEFAULT_VILLAGER_MAX_STAMINA;
    });
    const zombiesCleared = completedToday > 0 && boardSnapshot.zombieCount === 0;
    renderChecklist(
      assignedTasksTotal,
      staminaSpentWell,
      completedToday,
      boardSnapshot.openedDeckCards,
      zombiesCleared
    );
  };

  const refreshRemote = async () => {
    try {
      const [taskList, playerState] = await Promise.all([fetchTasksAll(), fetchPlayerState()]);
      tasks = taskList;
      villagerStamina = playerState.villagerStamina ?? {};
      renderGoals();
    } catch (err) {
      console.warn("goals sidebar refresh failed", err);
    }
  };

  const scheduleRemoteRefresh = (delayMs = 200) => {
    if (remoteRefreshPending) return;
    remoteRefreshPending = true;
    window.setTimeout(() => {
      remoteRefreshPending = false;
      void refreshRemote();
    }, delayMs);
  };

  createEffect(() => {
    boardSnapshot = collectBoardSnapshot(engine);
    renderGoals();
  });

  engine.events.on(() => scheduleRemoteRefresh());
  window.addEventListener("donegeon:force-refresh-goals", () => {
    void refreshRemote();
  });
  window.setInterval(() => {
    void refreshRemote();
  }, REMOTE_REFRESH_MS);

  void refreshRemote();
}

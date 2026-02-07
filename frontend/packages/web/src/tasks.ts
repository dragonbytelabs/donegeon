type Recurrence = { type: string; interval: number };

type TaskModifierSlot = { defId: string; data?: Record<string, any> };

type TaskDTO = {
  id: string;
  title: string;
  description: string;
  done: boolean;
  project?: string;
  tags: string[];
  modifiers: TaskModifierSlot[];
  dueDate?: string;
  nextAction: boolean;
  recurrence?: Recurrence;
  live?: boolean; 
  createdAt?: string;
  updatedAt?: string;
  assignedVillagerId?: string;
  workedToday?: boolean;
  processedCount?: number;
};

type PlayerStateDTO = {
  loot: Record<string, number>;
  unlocks: Record<string, boolean>;
  costs: {
    spawnTaskToBoardCoin: number;
    unlocks: Record<string, number>;
  };
};

const FEATURE_DUE_DATE = "task.due_date";
const FEATURE_NEXT_ACTION = "task.next_action";
const FEATURE_RECURRENCE = "task.recurrence";

function qs(id: string) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

function q<T extends Element>(root: ParentNode, sel: string): T {
  const el = root.querySelector(sel);
  if (!el) throw new Error(`Missing element ${sel}`);
  return el as T;
}

async function apiList(params: { status: string; project: string; live: boolean }) {
  const sp = new URLSearchParams();
  if (params.status && params.status !== "all") sp.set("status", params.status);
  if (params.project && params.project !== "any") sp.set("project", params.project);
  if (params.live) sp.set("live", "true");

  const res = await fetch(`/api/tasks?${sp.toString()}`);
  if (!res.ok) throw new Error(`GET /api/tasks failed: ${res.status}`);
  return (await res.json()) as TaskDTO[];
}

async function apiCreate(input: Omit<TaskDTO, "id">) {
  const res = await fetch(`/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`POST /api/tasks failed: ${res.status}`);
  return (await res.json()) as TaskDTO;
}

async function apiPatch(id: string, patch: Partial<Omit<TaskDTO, "id">>) {
  const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`PATCH /api/tasks/${id} failed: ${res.status}`);
  return (await res.json()) as TaskDTO;
}

async function apiProcess(id: string, markDone = false) {
  const res = await fetch(`/api/tasks/${encodeURIComponent(id)}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ markDone }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || `POST /api/tasks/${id}/process failed: ${res.status}`);
  }
  return data.task as TaskDTO;
}

async function apiGet(id: string) {
  const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`GET /api/tasks/${id} failed: ${res.status}`);
  return (await res.json()) as TaskDTO;
}

async function apiPlayerState() {
  const res = await fetch(`/api/player/state`);
  if (!res.ok) throw new Error(`GET /api/player/state failed: ${res.status}`);
  return (await res.json()) as PlayerStateDTO;
}

async function apiUnlockFeature(feature: string) {
  const res = await fetch(`/api/player/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feature }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || `POST /api/player/unlock failed: ${res.status}`);
  }
  return data.state as PlayerStateDTO;
}

async function apiSpawnTaskToBoard(taskId: string, x: number, y: number) {
  const res = await fetch(`/api/board/cmd`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cmd: "task.spawn_existing",
      args: { taskId, x, y },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || `POST /api/board/cmd failed: ${res.status}`);
  }
}

// ---------- UI state ----------
const statusSel = qs("filterStatus") as HTMLSelectElement;
const projectSel = qs("filterProject") as HTMLSelectElement;
const liveChk = qs("filterLive") as HTMLInputElement;
const refreshBtn = qs("filterRefresh") as HTMLButtonElement;
const countEl = qs("taskCount") as HTMLDivElement;
const listEl = qs("tasksList") as HTMLDivElement;
const rowTpl = qs("taskRowTpl") as HTMLTemplateElement;

const newBtn = qs("taskNewBtn") as HTMLButtonElement;
const priorPlayerEl = document.getElementById("tasksLootInline");
if (priorPlayerEl) priorPlayerEl.remove();
const playerEl = document.createElement("div");
playerEl.id = "tasksLootInline";
playerEl.className = "text-sm opacity-80";
playerEl.textContent = "🪙 0";
countEl.parentElement?.insertBefore(playerEl, countEl);

// Editor modal refs
const overlay = qs("taskEditorOverlay") as HTMLDivElement;
const panel = qs("taskEditorPanel") as HTMLDivElement;

const editor = {
  title: q<HTMLInputElement>(panel, "[data-title]"),
  desc: q<HTMLTextAreaElement>(panel, "[data-desc]"),
  done: q<HTMLInputElement>(panel, "[data-done]"),
  project: q<HTMLInputElement>(panel, "[data-project]"),
  tags: q<HTMLInputElement>(panel, "[data-tags]"),
  dueDate: q<HTMLInputElement>(panel, "[data-duedate]"),
  nextAction: q<HTMLInputElement>(panel, "[data-nextaction]"),
  recType: q<HTMLSelectElement>(panel, "[data-rectype]"),
  recInv: q<HTMLInputElement>(panel, "[data-recinv]"),
  modifiers: q<HTMLTextAreaElement>(panel, "[data-modifiers]"),
  err: q<HTMLDivElement>(panel, "[data-error]"),
  btnClose: q<HTMLButtonElement>(panel, "[data-editor-close]"),
  btnSave: q<HTMLButtonElement>(panel, "[data-editor-save]"),
};

let unlockButtons:
  | {
      dueDate: HTMLButtonElement;
      nextAction: HTMLButtonElement;
      recurrence: HTMLButtonElement;
    }
  | null = null;

let editingId: string | null = null;
let playerState: PlayerStateDTO | null = null;

function coinBalance(): number {
  return Number(playerState?.loot?.["coin"] ?? 0);
}

function unlockCost(feature: string): number {
  return Number(playerState?.costs?.unlocks?.[feature] ?? 0);
}

function isUnlocked(feature: string): boolean {
  return !!playerState?.unlocks?.[feature];
}

function renderPlayerState() {
  playerEl.textContent = `🪙 ${coinBalance()}`;
}

async function loadPlayerState() {
  playerState = await apiPlayerState();
  renderPlayerState();
}

function ensureUnlockButtons() {
  if (unlockButtons) return unlockButtons;

  const mk = (label: string) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ml-2 rounded-md border border-white/20 bg-white/10 px-2 py-0.5 text-xs hover:bg-white/15";
    b.textContent = label;
    return b;
  };

  const dueBtn = mk("Unlock");
  const nextBtn = mk("Unlock");
  const recBtn = mk("Unlock");

  const dueHost = editor.dueDate.closest("label")?.querySelector("div") ?? editor.dueDate.closest("label");
  dueHost?.appendChild(dueBtn);

  const nextHost = editor.nextAction.closest("label");
  nextHost?.appendChild(nextBtn);

  const recHost = editor.recType.closest("div")?.querySelector("label") ?? editor.recType.closest("div");
  recHost?.appendChild(recBtn);

  unlockButtons = {
    dueDate: dueBtn,
    nextAction: nextBtn,
    recurrence: recBtn,
  };
  return unlockButtons;
}

function applyEditorGates() {
  const btns = ensureUnlockButtons();

  const dueOpen = isUnlocked(FEATURE_DUE_DATE);
  editor.dueDate.disabled = !dueOpen;
  btns.dueDate.style.display = dueOpen ? "none" : "";
  btns.dueDate.textContent = `Unlock (${unlockCost(FEATURE_DUE_DATE)} 🪙)`;

  const nextOpen = isUnlocked(FEATURE_NEXT_ACTION);
  editor.nextAction.disabled = !nextOpen;
  btns.nextAction.style.display = nextOpen ? "none" : "";
  btns.nextAction.textContent = `Unlock (${unlockCost(FEATURE_NEXT_ACTION)} 🪙)`;

  const recOpen = isUnlocked(FEATURE_RECURRENCE);
  editor.recType.disabled = !recOpen;
  editor.recInv.disabled = !recOpen;
  btns.recurrence.style.display = recOpen ? "none" : "";
  btns.recurrence.textContent = `Unlock (${unlockCost(FEATURE_RECURRENCE)} 🪙)`;
}

async function unlockFeature(feature: string) {
  playerState = await apiUnlockFeature(feature);
  renderPlayerState();
  applyEditorGates();
}

async function openEditor(task?: TaskDTO) {
  if (!playerState) {
    await loadPlayerState();
  }
  editor.err.textContent = "";
  editingId = task?.id ?? null;

  editor.title.value = task?.title ?? "";
  editor.desc.value = task?.description ?? "";
  editor.done.checked = !!task?.done;
  editor.project.value = task?.project && task.project !== "inbox" ? task.project : "";
  editor.tags.value = (task?.tags ?? []).join(", ");
  editor.dueDate.value = task?.dueDate ?? "";
  editor.nextAction.checked = !!task?.nextAction;

  editor.recType.value = task?.recurrence?.type ?? "";
  editor.recInv.value = String(task?.recurrence?.interval ?? 1);

  editor.modifiers.value = JSON.stringify(task?.modifiers ?? [], null, 2);
  applyEditorGates();

  overlay.classList.remove("hidden");
  overlay.classList.add("flex");
}

function closeEditor() {
  overlay.classList.add("hidden");
  overlay.classList.remove("flex");
  editingId = null;
}

function normalizeProject(p: string): string | undefined {
  const t = p.trim();
  if (!t) return undefined; // backend normalizes to inbox
  return t;
}

function parseModifiers(text: string): TaskModifierSlot[] {
  const raw = text.trim();
  if (!raw) return [];
  const v = JSON.parse(raw);
  if (!Array.isArray(v)) throw new Error("Modifiers must be a JSON array");
  if (v.length > 4) throw new Error("Too many modifiers (max 4)");
  for (const m of v) {
    if (!m || typeof m !== "object") throw new Error("Modifier must be an object");
    if (typeof (m as any).defId !== "string" || !(m as any).defId.trim()) {
      throw new Error('Modifier requires "defId" string');
    }
  }
  return v as TaskModifierSlot[];
}

function collectEditor(): Omit<TaskDTO, "id"> {
  const title = editor.title.value.trim();
  if (!title) throw new Error("Title is required");

  const dueUnlocked = isUnlocked(FEATURE_DUE_DATE);
  const nextUnlocked = isUnlocked(FEATURE_NEXT_ACTION);
  const recurrenceUnlocked = isUnlocked(FEATURE_RECURRENCE);

  const recType = recurrenceUnlocked ? editor.recType.value.trim() : "";
  const recurrence =
    recType === ""
      ? undefined
      : {
          type: recType,
          interval: Math.max(1, Number(editor.recInv.value || "1")),
        };

  return {
    title,
    description: editor.desc.value.trim(),
    done: editor.done.checked,
    project: normalizeProject(editor.project.value),
    tags: editor.tags.value.split(",").map(s => s.trim()).filter(Boolean),
    dueDate: dueUnlocked && editor.dueDate.value ? editor.dueDate.value : undefined,
    nextAction: nextUnlocked ? editor.nextAction.checked : false,
    recurrence,
    modifiers: parseModifiers(editor.modifiers.value),
  };
}

function render(tasks: TaskDTO[]) {
  listEl.innerHTML = "";
  countEl.textContent = `${tasks.length} task${tasks.length === 1 ? "" : "s"}`;

  const frag = document.createDocumentFragment();

  const spawnCost = Number(playerState?.costs?.spawnTaskToBoardCoin ?? 3);

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const node = rowTpl.content.cloneNode(true) as DocumentFragment;
    const row = q<HTMLDivElement>(node, "[data-row]");

    const done = q<HTMLInputElement>(node, "[data-done]");
    const title = q<HTMLDivElement>(node, "[data-title]");
    const proj = q<HTMLSpanElement>(node, "[data-project]");
    const desc = q<HTMLDivElement>(node, "[data-desc]");
    const due = q<HTMLDivElement>(node, "[data-due]");

    done.checked = !!t.done;
    if (!t.done && !t.assignedVillagerId) {
      done.disabled = true;
      done.title = "Assign a villager on the board before completing this task.";
    } else {
      done.disabled = false;
      done.title = "";
    }
    title.textContent = t.title || "(untitled)";
    desc.textContent = t.description || "";
    proj.textContent = (t.project && t.project.trim()) ? t.project : "inbox";
    due.textContent = t.dueDate ? `Due ${t.dueDate}` : "";

    // Toggle done (stop row click)
    done.addEventListener("click", (e) => e.stopPropagation());
    done.addEventListener("change", async () => {
      try {
        await apiPatch(t.id, { done: done.checked });
        await refresh();
      } catch (err: any) {
        alert(String(err?.message ?? err));
        done.checked = !done.checked;
      }
    });

    // Click row = edit
    row.addEventListener("click", async () => {
      try {
        const full = await apiGet(t.id);
        await openEditor(full);
      } catch (err: any) {
        alert(String(err?.message ?? err));
      }
    });

    const actionWrap = document.createElement("div");
    actionWrap.className = "flex items-center gap-2";

    const processBtn = document.createElement("button");
    processBtn.type = "button";
    processBtn.className = "rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed";
    if (t.done) {
      processBtn.textContent = "Done";
      processBtn.disabled = true;
    } else if (!t.assignedVillagerId) {
      processBtn.textContent = "Needs Villager";
      processBtn.disabled = true;
    } else {
      processBtn.textContent = `Process (${t.processedCount ?? 0})`;
      processBtn.disabled = false;
    }
    processBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (processBtn.disabled) return;
      try {
        await apiProcess(t.id, false);
        await refresh();
      } catch (err: any) {
        alert(String(err?.message ?? err));
      }
    });
    actionWrap.appendChild(processBtn);

    const spawnBtn = document.createElement("button");
    spawnBtn.type = "button";
    spawnBtn.className = "rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed";

    const coin = coinBalance();
    if (t.live) {
      spawnBtn.textContent = "On Board";
      spawnBtn.disabled = true;
    } else if (t.done) {
      spawnBtn.textContent = "Completed";
      spawnBtn.disabled = true;
    } else if (coin < spawnCost) {
      spawnBtn.textContent = `Need ${spawnCost} 🪙`;
      spawnBtn.disabled = true;
    } else {
      spawnBtn.textContent = `To Board (${spawnCost} 🪙)`;
      spawnBtn.disabled = false;
    }

    spawnBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (spawnBtn.disabled) return;
      try {
        const x = 260 + (i % 5) * 120;
        const y = 220 + (Math.floor(i / 5) % 4) * 120;
        await apiSpawnTaskToBoard(t.id, x, y);
        await refresh();
      } catch (err: any) {
        alert(String(err?.message ?? err));
      }
    });
    actionWrap.appendChild(spawnBtn);
    row.appendChild(actionWrap);

    frag.appendChild(node);
  }

  listEl.appendChild(frag);
}

async function refresh() {
  const [tasks, state] = await Promise.all([
    apiList({
      status: statusSel.value,
      project: projectSel.value,
      live: liveChk.checked,
    }),
    apiPlayerState(),
  ]);
  playerState = state;
  renderPlayerState();
  const open = !overlay.classList.contains("hidden");
  if (open) applyEditorGates();
  render(tasks);
}

async function initialLoad() {
  if (!playerState) {
    await loadPlayerState();
  }
  const tasks = await apiList({
    status: statusSel.value,
    project: projectSel.value,
    live: liveChk.checked,
  });
  render(tasks);
}

// ---------- wire up ----------
const GLOBAL_KEY = "__donegeon_tasks_init__";
const g = globalThis as any;

function initOnce() {
  // If we already initialized (HMR re-run), remove old listeners.
  const prev: AbortController | undefined = g[GLOBAL_KEY];
  if (prev) prev.abort();

  const controller = new AbortController();
  g[GLOBAL_KEY] = controller;

  const on = (target: EventTarget, type: string, handler: any, opts?: AddEventListenerOptions) => {
    target.addEventListener(type, handler, { ...opts, signal: controller.signal });
  };

  on(overlay, "pointerdown", (e: PointerEvent) => {
    if (e.target === overlay) closeEditor();
  });

  on(editor.btnClose, "click", closeEditor);
  const btns = ensureUnlockButtons();
  on(btns.dueDate, "click", async (e: MouseEvent) => {
    e.preventDefault();
    try {
      await unlockFeature(FEATURE_DUE_DATE);
    } catch (err: any) {
      editor.err.textContent = String(err?.message ?? err);
    }
  });
  on(btns.nextAction, "click", async (e: MouseEvent) => {
    e.preventDefault();
    try {
      await unlockFeature(FEATURE_NEXT_ACTION);
    } catch (err: any) {
      editor.err.textContent = String(err?.message ?? err);
    }
  });
  on(btns.recurrence, "click", async (e: MouseEvent) => {
    e.preventDefault();
    try {
      await unlockFeature(FEATURE_RECURRENCE);
    } catch (err: any) {
      editor.err.textContent = String(err?.message ?? err);
    }
  });

  let saving = false;
  on(editor.btnSave, "click", async (e: MouseEvent) => {
    e.preventDefault();
    if (saving) return;

    saving = true;
    editor.btnSave.disabled = true;

    editor.err.textContent = "";
    try {
      const payload = collectEditor();
      if (!editingId) await apiCreate(payload);
      else await apiPatch(editingId, payload);

      closeEditor();
      await refresh();
    } catch (err: any) {
      editor.err.textContent = String(err?.message ?? err);
    } finally {
      saving = false;
      editor.btnSave.disabled = false;
    }
  });

  on(newBtn, "click", () => {
    void openEditor();
  });
  on(refreshBtn, "click", () => {
    void refresh();
  });
  on(statusSel, "change", () => {
    void refresh();
  });
  on(projectSel, "change", () => {
    void refresh();
  });
  on(liveChk, "change", () => {
    void refresh();
  });

  refresh().catch((e) => {
    console.error(e);
    countEl.textContent = "Failed to load tasks";
  });

  // Vite HMR: cleanup when module is replaced
  // @ts-ignore
  if (import.meta?.hot) {
    // @ts-ignore
    import.meta.hot.dispose(() => controller.abort());
  }
}

initOnce();

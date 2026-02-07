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
  completionCount?: number;
  habit?: boolean;
  habitTier?: number;
  habitStreak?: number;
  lastCompletedDate?: string;
};

type BlueprintDTO = {
  id: string;
  title: string;
  description: string;
  modifierSlots: string[];
  steps: string[];
  createdAt?: string;
};

type PluginManifestDTO = {
  id: string;
  name: string;
  description: string;
  provider: string;
  category: string;
  version: string;
  cardDefId: string;
  cardTitle: string;
  cardIcon: string;
  installCost: number;
  capabilities?: string[];
  source: "core" | "community";
};

type PluginMarketplaceItemDTO = PluginManifestDTO & {
  installed: boolean;
};

type PluginInstalledDetailDTO = PluginManifestDTO & {
  installedAt: string;
  enabled: boolean;
};

type PluginMarketplaceStateDTO = {
  marketplace: PluginMarketplaceItemDTO[];
  installed: PluginInstalledDetailDTO[];
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

async function apiCompleteOnBoard(taskId: string) {
  const res = await fetch(`/api/board/cmd`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cmd: "task.complete_by_task_id",
      args: { taskId },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || `POST /api/board/cmd failed: ${res.status}`);
  }
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

async function apiBlueprintList() {
  const res = await fetch(`/api/blueprints`);
  if (!res.ok) throw new Error(`GET /api/blueprints failed: ${res.status}`);
  return (await res.json()) as BlueprintDTO[];
}

async function apiBlueprintCreate(input: Omit<BlueprintDTO, "id" | "createdAt">) {
  const res = await fetch(`/api/blueprints`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`POST /api/blueprints failed: ${res.status}`);
  return (await res.json()) as BlueprintDTO;
}

async function apiSpawnBlueprintToBoard(blueprint: BlueprintDTO, x: number, y: number) {
  const res = await fetch(`/api/board/cmd`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cmd: "card.spawn",
      args: {
        defId: "blueprint.instance",
        x,
        y,
        data: {
          blueprintId: blueprint.id,
          title: blueprint.title,
          description: blueprint.description,
          modifierSlots: blueprint.modifierSlots,
          steps: blueprint.steps,
        },
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || `POST /api/board/cmd failed: ${res.status}`);
  }
}

async function apiPluginMarketplace() {
  const res = await fetch(`/api/plugins/marketplace`);
  if (!res.ok) throw new Error(`GET /api/plugins/marketplace failed: ${res.status}`);
  return (await res.json()) as PluginMarketplaceStateDTO;
}

async function apiPluginRegister(input: PluginManifestDTO) {
  const res = await fetch(`/api/plugins/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ manifest: input }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `POST /api/plugins/register failed: ${res.status}`);
  return data as PluginManifestDTO;
}

async function apiPluginInstall(pluginId: string) {
  const res = await fetch(`/api/plugins/install`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pluginId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || `POST /api/plugins/install failed: ${res.status}`);
  return data;
}

async function apiPluginUninstall(pluginId: string) {
  const res = await fetch(`/api/plugins/uninstall`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pluginId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || `POST /api/plugins/uninstall failed: ${res.status}`);
  return data;
}

async function apiSpawnPluginToBoard(plugin: PluginManifestDTO, x: number, y: number) {
  const res = await fetch(`/api/board/cmd`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cmd: "card.spawn",
      args: {
        defId: plugin.cardDefId,
        x,
        y,
        data: {
          pluginId: plugin.id,
          pluginName: plugin.name,
          title: plugin.cardTitle || plugin.name,
          icon: plugin.cardIcon || "🔌",
          provider: plugin.provider,
          category: plugin.category,
          capabilities: plugin.capabilities ?? [],
        },
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || `POST /api/board/cmd failed: ${res.status}`);
  }
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

type BlueprintUIRefs = {
  root: HTMLDivElement;
  title: HTMLInputElement;
  desc: HTMLTextAreaElement;
  mods: HTMLInputElement;
  steps: HTMLTextAreaElement;
  createBtn: HTMLButtonElement;
  sampleBtn: HTMLButtonElement;
  list: HTMLDivElement;
  err: HTMLDivElement;
};

type PluginUIRefs = {
  root: HTMLDivElement;
  id: HTMLInputElement;
  name: HTMLInputElement;
  provider: HTMLInputElement;
  category: HTMLInputElement;
  cardTitle: HTMLInputElement;
  cardIcon: HTMLInputElement;
  installCost: HTMLInputElement;
  desc: HTMLTextAreaElement;
  cardDef: HTMLInputElement;
  capabilities: HTMLInputElement;
  registerBtn: HTMLButtonElement;
  sampleBtn: HTMLButtonElement;
  list: HTMLDivElement;
  err: HTMLDivElement;
};

let blueprintUI: BlueprintUIRefs | null = null;
let blueprints: BlueprintDTO[] = [];
let pluginUI: PluginUIRefs | null = null;
let pluginState: PluginMarketplaceStateDTO = { marketplace: [], installed: [] };

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

function ensureBlueprintUI(): BlueprintUIRefs {
  if (blueprintUI) return blueprintUI;
  const page = document.querySelector(".mx-auto.max-w-5xl") as HTMLDivElement | null;
  if (!page) throw new Error("Missing tasks page root");

  const root = document.createElement("div");
  root.id = "blueprints";
  root.className = "mt-6 rounded-lg border border-border bg-card p-4";
  root.innerHTML = `
    <div class="mb-3">
      <div class="text-sm font-semibold">Blueprint Workshop</div>
      <div class="text-xs opacity-70">Create reusable planning cards, then spawn them to the board.</div>
    </div>
    <div class="grid gap-2 md:grid-cols-2">
      <div>
        <label class="text-xs opacity-70">Title</label>
        <input data-bp-title class="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm" placeholder="Create a new coding project" />
      </div>
      <div>
        <label class="text-xs opacity-70">Modifier slots (comma-separated)</label>
        <input data-bp-mods class="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm" placeholder="mod.next_action, mod.deadline_pin, mod.recurring" />
      </div>
    </div>
    <div class="mt-2">
      <label class="text-xs opacity-70">Description</label>
      <textarea data-bp-desc rows="2" class="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm" placeholder="Plan repo setup, scaffold app, write task plan, and align milestones."></textarea>
    </div>
    <div class="mt-2">
      <label class="text-xs opacity-70">Steps (one per line)</label>
      <textarea data-bp-steps rows="4" class="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm" placeholder="Create GitHub repo&#10;Run create-vite&#10;Setup server baseline&#10;Write task.md plan"></textarea>
    </div>
    <div class="mt-3 flex items-center gap-2">
      <button data-bp-create type="button" class="rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent">Create Blueprint</button>
      <button data-bp-sample type="button" class="rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent">Load Sample</button>
      <div data-bp-err class="text-xs text-red-300"></div>
    </div>
    <div data-bp-list class="mt-4 space-y-2"></div>
  `;
  page.appendChild(root);

  blueprintUI = {
    root,
    title: q<HTMLInputElement>(root, "[data-bp-title]"),
    desc: q<HTMLTextAreaElement>(root, "[data-bp-desc]"),
    mods: q<HTMLInputElement>(root, "[data-bp-mods]"),
    steps: q<HTMLTextAreaElement>(root, "[data-bp-steps]"),
    createBtn: q<HTMLButtonElement>(root, "[data-bp-create]"),
    sampleBtn: q<HTMLButtonElement>(root, "[data-bp-sample]"),
    list: q<HTMLDivElement>(root, "[data-bp-list]"),
    err: q<HTMLDivElement>(root, "[data-bp-err]"),
  };
  return blueprintUI;
}

function renderBlueprintList() {
  const ui = ensureBlueprintUI();
  ui.list.innerHTML = "";
  if (blueprints.length === 0) {
    const empty = document.createElement("div");
    empty.className = "text-xs opacity-70";
    empty.textContent = "No blueprints yet.";
    ui.list.appendChild(empty);
    return;
  }

  blueprints.forEach((bp, index) => {
    const row = document.createElement("div");
    row.className = "rounded-md border border-border bg-background px-3 py-2";

    const top = document.createElement("div");
    top.className = "flex items-center gap-2";
    const title = document.createElement("div");
    title.className = "text-sm font-medium";
    title.textContent = bp.title;
    const badge = document.createElement("span");
    badge.className = "rounded-full border border-border px-2 py-0.5 text-[10px] opacity-70";
    badge.textContent = `slots ${bp.modifierSlots.length}`;
    top.append(title, badge);

    const desc = document.createElement("div");
    desc.className = "mt-1 text-xs opacity-75";
    desc.textContent = bp.description || "(no description)";

    const steps = document.createElement("div");
    steps.className = "mt-1 text-xs opacity-70";
    steps.textContent = bp.steps.length > 0 ? `Steps: ${bp.steps.join(" -> ")}` : "Steps: (none)";

    const actions = document.createElement("div");
    actions.className = "mt-2 flex items-center gap-2";
    const spawnBtn = document.createElement("button");
    spawnBtn.type = "button";
    spawnBtn.className = "rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-accent";
    spawnBtn.textContent = "Spawn To Board";
    spawnBtn.addEventListener("click", async () => {
      try {
        const x = 220 + (index % 5) * 120;
        const y = 180 + (Math.floor(index / 5) % 4) * 120;
        await apiSpawnBlueprintToBoard(bp, x, y);
        window.location.href = "/board";
      } catch (err: any) {
        alert(String(err?.message ?? err));
      }
    });
    actions.appendChild(spawnBtn);

    row.append(top, desc, steps, actions);
    ui.list.appendChild(row);
  });
}

async function refreshBlueprints() {
  blueprints = await apiBlueprintList();
  renderBlueprintList();
}

function ensurePluginUI(): PluginUIRefs {
  if (pluginUI) return pluginUI;
  const page = document.querySelector(".mx-auto.max-w-5xl") as HTMLDivElement | null;
  if (!page) throw new Error("Missing tasks page root");

  const root = document.createElement("div");
  root.id = "plugins";
  root.className = "mt-6 rounded-lg border border-border bg-card p-4";
  root.innerHTML = `
    <div class="mb-3">
      <div class="text-sm font-semibold">Plugin Marketplace</div>
      <div class="text-xs opacity-70">Install core integrations, or register community plugin manifests without restarting the server.</div>
    </div>
    <div class="grid gap-2 md:grid-cols-3">
      <div>
        <label class="text-xs opacity-70">Plugin id</label>
        <input data-pl-id class="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm" placeholder="jira_workflow_plus" />
      </div>
      <div>
        <label class="text-xs opacity-70">Name</label>
        <input data-pl-name class="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm" placeholder="Jira Workflow Plus" />
      </div>
      <div>
        <label class="text-xs opacity-70">Provider</label>
        <input data-pl-provider class="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm" placeholder="Community" />
      </div>
    </div>
    <div class="mt-2 grid gap-2 md:grid-cols-4">
      <div>
        <label class="text-xs opacity-70">Category</label>
        <input data-pl-category class="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm" placeholder="work" />
      </div>
      <div>
        <label class="text-xs opacity-70">Card title</label>
        <input data-pl-card-title class="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm" placeholder="Jira Connector" />
      </div>
      <div>
        <label class="text-xs opacity-70">Card icon</label>
        <input data-pl-card-icon class="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm" placeholder="🧩" />
      </div>
      <div>
        <label class="text-xs opacity-70">Install cost (coin)</label>
        <input data-pl-install-cost type="number" min="0" value="2" class="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm" />
      </div>
    </div>
    <div class="mt-2 grid gap-2 md:grid-cols-2">
      <div>
        <label class="text-xs opacity-70">Card def id</label>
        <input data-pl-card-def class="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm" placeholder="mod.plugin_jira_workflow_plus" />
      </div>
      <div>
        <label class="text-xs opacity-70">Capabilities (comma-separated)</label>
        <input data-pl-caps class="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm" placeholder="issue.link, issue.transition" />
      </div>
    </div>
    <div class="mt-2">
      <label class="text-xs opacity-70">Description</label>
      <textarea data-pl-desc rows="2" class="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm" placeholder="Adds Jira issue linking and transitions from task cards."></textarea>
    </div>
    <div class="mt-3 flex items-center gap-2">
      <button data-pl-register type="button" class="rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent">Register Manifest</button>
      <button data-pl-sample type="button" class="rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent">Load Sample</button>
      <div data-pl-err class="text-xs text-red-300"></div>
    </div>
    <div data-pl-list class="mt-4 space-y-2"></div>
  `;
  page.appendChild(root);

  pluginUI = {
    root,
    id: q<HTMLInputElement>(root, "[data-pl-id]"),
    name: q<HTMLInputElement>(root, "[data-pl-name]"),
    provider: q<HTMLInputElement>(root, "[data-pl-provider]"),
    category: q<HTMLInputElement>(root, "[data-pl-category]"),
    cardTitle: q<HTMLInputElement>(root, "[data-pl-card-title]"),
    cardIcon: q<HTMLInputElement>(root, "[data-pl-card-icon]"),
    installCost: q<HTMLInputElement>(root, "[data-pl-install-cost]"),
    cardDef: q<HTMLInputElement>(root, "[data-pl-card-def]"),
    capabilities: q<HTMLInputElement>(root, "[data-pl-caps]"),
    desc: q<HTMLTextAreaElement>(root, "[data-pl-desc]"),
    registerBtn: q<HTMLButtonElement>(root, "[data-pl-register]"),
    sampleBtn: q<HTMLButtonElement>(root, "[data-pl-sample]"),
    list: q<HTMLDivElement>(root, "[data-pl-list]"),
    err: q<HTMLDivElement>(root, "[data-pl-err]"),
  };
  return pluginUI;
}

function isPluginInstalled(id: string): boolean {
  return pluginState.installed.some((p) => p.id === id);
}

function renderPluginList() {
  const ui = ensurePluginUI();
  ui.list.innerHTML = "";
  if (pluginState.marketplace.length === 0) {
    const empty = document.createElement("div");
    empty.className = "text-xs opacity-70";
    empty.textContent = "No plugins available.";
    ui.list.appendChild(empty);
    return;
  }

  pluginState.marketplace.forEach((plugin, index) => {
    const row = document.createElement("div");
    row.className = "rounded-md border border-border bg-background px-3 py-2";

    const top = document.createElement("div");
    top.className = "flex items-center gap-2";
    const title = document.createElement("div");
    title.className = "text-sm font-medium";
    title.textContent = `${plugin.cardIcon || "🔌"} ${plugin.name}`;
    const source = document.createElement("span");
    source.className = "rounded-full border border-border px-2 py-0.5 text-[10px] opacity-70";
    source.textContent = plugin.source;
    const cat = document.createElement("span");
    cat.className = "rounded-full border border-border px-2 py-0.5 text-[10px] opacity-70";
    cat.textContent = plugin.category || "general";
    top.append(title, source, cat);

    const desc = document.createElement("div");
    desc.className = "mt-1 text-xs opacity-75";
    desc.textContent = plugin.description || "(no description)";

    const meta = document.createElement("div");
    meta.className = "mt-1 text-[11px] opacity-65";
    const installed = isPluginInstalled(plugin.id);
    meta.textContent = `${plugin.provider || "provider"} • v${plugin.version} • card ${plugin.cardDefId}${installed ? " • installed" : ""}`;

    const actions = document.createElement("div");
    actions.className = "mt-2 flex items-center gap-2";

    const installBtn = document.createElement("button");
    installBtn.type = "button";
    installBtn.className = "rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed";
    if (installed) {
      installBtn.textContent = "Installed";
      installBtn.disabled = true;
    } else if (coinBalance() < Number(plugin.installCost ?? 0)) {
      installBtn.textContent = `Need ${plugin.installCost} 🪙`;
      installBtn.disabled = true;
    } else {
      installBtn.textContent = `Install (${plugin.installCost} 🪙)`;
      installBtn.disabled = false;
      installBtn.addEventListener("click", async () => {
        try {
          await apiPluginInstall(plugin.id);
          await refreshPlugins();
          await loadPlayerState();
        } catch (err: any) {
          ui.err.textContent = String(err?.message ?? err);
        }
      });
    }
    actions.appendChild(installBtn);

    if (installed) {
      const spawnBtn = document.createElement("button");
      spawnBtn.type = "button";
      spawnBtn.className = "rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-accent";
      spawnBtn.textContent = "Spawn Card";
      spawnBtn.addEventListener("click", async () => {
        try {
          const x = 260 + (index % 6) * 110;
          const y = 180 + (Math.floor(index / 6) % 4) * 110;
          await apiSpawnPluginToBoard(plugin, x, y);
          window.location.href = "/board";
        } catch (err: any) {
          ui.err.textContent = String(err?.message ?? err);
        }
      });
      actions.appendChild(spawnBtn);

      const uninstallBtn = document.createElement("button");
      uninstallBtn.type = "button";
      uninstallBtn.className = "rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-accent";
      uninstallBtn.textContent = "Uninstall";
      uninstallBtn.addEventListener("click", async () => {
        try {
          await apiPluginUninstall(plugin.id);
          await refreshPlugins();
        } catch (err: any) {
          ui.err.textContent = String(err?.message ?? err);
        }
      });
      actions.appendChild(uninstallBtn);
    }

    row.append(top, desc, meta, actions);
    ui.list.appendChild(row);
  });
}

function collectPluginInput(): PluginManifestDTO {
  const ui = ensurePluginUI();
  const id = ui.id.value.trim();
  const name = ui.name.value.trim();
  const provider = ui.provider.value.trim() || "Community";
  const category = ui.category.value.trim() || "automation";
  const cardTitle = ui.cardTitle.value.trim() || name || id;
  const cardIcon = ui.cardIcon.value.trim() || "🔌";
  const installCost = Math.max(0, Number(ui.installCost.value || "0"));
  const description = ui.desc.value.trim();
  const cardDefId = (ui.cardDef.value.trim() || `mod.plugin_${id}`).toLowerCase();
  const capabilities = ui.capabilities.value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    id,
    name,
    provider,
    category,
    description,
    version: "1.0.0",
    cardDefId,
    cardTitle,
    cardIcon,
    installCost,
    capabilities,
    source: "community",
  };
}

async function refreshPlugins() {
  pluginState = await apiPluginMarketplace();
  renderPluginList();
}

function collectBlueprintInput() {
  const ui = ensureBlueprintUI();
  const title = ui.title.value.trim();
  const description = ui.desc.value.trim();
  const modifierSlots = ui.mods.value.split(",").map((s) => s.trim()).filter(Boolean);
  const steps = ui.steps.value.split("\n").map((s) => s.trim()).filter(Boolean);
  return { title, description, modifierSlots, steps };
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
    const habitBits: string[] = [];
    if (t.habit) {
      habitBits.push(`Habit T${Math.max(1, Number(t.habitTier ?? 1))}`);
    }
    if ((t.habitStreak ?? 0) > 0) {
      habitBits.push(`Streak ${t.habitStreak}`);
    }
    if ((t.completionCount ?? 0) > 0) {
      habitBits.push(`Completions ${t.completionCount}`);
    }
    const right = t.dueDate ? `Due ${t.dueDate}` : "";
    due.textContent = [right, ...habitBits].filter(Boolean).join(" • ");

    // Toggle done (stop row click)
    done.addEventListener("click", (e) => e.stopPropagation());
    done.addEventListener("change", async () => {
      try {
        if (done.checked && t.live) {
          await apiCompleteOnBoard(t.id);
        } else {
          await apiPatch(t.id, { done: done.checked });
        }
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
  const [tasks, state, bp, plugins] = await Promise.all([
    apiList({
      status: statusSel.value,
      project: projectSel.value,
      live: liveChk.checked,
    }),
    apiPlayerState(),
    apiBlueprintList(),
    apiPluginMarketplace(),
  ]);
  playerState = state;
  blueprints = bp;
  pluginState = plugins;
  renderPlayerState();
  const open = !overlay.classList.contains("hidden");
  if (open) applyEditorGates();
  render(tasks);
  renderBlueprintList();
  renderPluginList();
}

async function initialLoad() {
  if (!playerState) {
    await loadPlayerState();
  }
  const [tasks, bp, plugins] = await Promise.all([
    apiList({
      status: statusSel.value,
      project: projectSel.value,
      live: liveChk.checked,
    }),
    apiBlueprintList(),
    apiPluginMarketplace(),
  ]);
  blueprints = bp;
  pluginState = plugins;
  render(tasks);
  renderBlueprintList();
  renderPluginList();
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

  const bpUI = ensureBlueprintUI();
  const plUI = ensurePluginUI();
  if (window.location.hash === "#blueprints") {
    window.setTimeout(() => {
      bpUI.root.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  } else if (window.location.hash === "#plugins") {
    window.setTimeout(() => {
      plUI.root.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

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
  on(bpUI.sampleBtn, "click", () => {
    bpUI.title.value = "Create a new coding project";
    bpUI.desc.value = "Set up repository, scaffold app, and produce a concrete task plan for execution.";
    bpUI.mods.value = "mod.next_action, mod.deadline_pin, mod.recurring";
    bpUI.steps.value = [
      "Create GitHub repository",
      "Run create-vite and scaffold server",
      "Create task.md execution plan",
      "Define milestone tasks and owners",
    ].join("\n");
  });
  on(bpUI.createBtn, "click", async () => {
    bpUI.err.textContent = "";
    try {
      const payload = collectBlueprintInput();
      if (!payload.title) {
        bpUI.err.textContent = "Blueprint title is required.";
        return;
      }
      await apiBlueprintCreate(payload);
      bpUI.title.value = "";
      bpUI.desc.value = "";
      bpUI.mods.value = "";
      bpUI.steps.value = "";
      await refreshBlueprints();
    } catch (err: any) {
      bpUI.err.textContent = String(err?.message ?? err);
    }
  });
  on(plUI.sampleBtn, "click", () => {
    plUI.id.value = "jira_workflow_plus";
    plUI.name.value = "Jira Workflow Plus";
    plUI.provider.value = "Community";
    plUI.category.value = "work";
    plUI.cardTitle.value = "Jira Workflow";
    plUI.cardIcon.value = "🧩";
    plUI.installCost.value = "3";
    plUI.cardDef.value = "mod.plugin_jira_workflow_plus";
    plUI.capabilities.value = "issue.link, issue.transition";
    plUI.desc.value = "Adds Jira issue linking and status transitions from task stacks.";
  });
  on(plUI.registerBtn, "click", async () => {
    plUI.err.textContent = "";
    try {
      const payload = collectPluginInput();
      if (!payload.id || !payload.name) {
        plUI.err.textContent = "Plugin id and name are required.";
        return;
      }
      if (!payload.cardDefId.startsWith("mod.plugin_")) {
        plUI.err.textContent = "Card def id must start with mod.plugin_.";
        return;
      }
      await apiPluginRegister(payload);
      await refreshPlugins();
      plUI.id.value = "";
      plUI.name.value = "";
      plUI.desc.value = "";
      plUI.cardDef.value = "";
      plUI.capabilities.value = "";
    } catch (err: any) {
      plUI.err.textContent = String(err?.message ?? err);
    }
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

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
};

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

async function apiGet(id: string) {
  const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`GET /api/tasks/${id} failed: ${res.status}`);
  return (await res.json()) as TaskDTO;
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

let editingId: string | null = null;

function openEditor(task?: TaskDTO) {
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

  const recType = editor.recType.value.trim();
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
    dueDate: editor.dueDate.value ? editor.dueDate.value : undefined,
    nextAction: editor.nextAction.checked,
    recurrence,
    modifiers: parseModifiers(editor.modifiers.value),
  };
}

function render(tasks: TaskDTO[]) {
  listEl.innerHTML = "";
  countEl.textContent = `${tasks.length} task${tasks.length === 1 ? "" : "s"}`;

  const frag = document.createDocumentFragment();

  for (const t of tasks) {
    const node = rowTpl.content.cloneNode(true) as DocumentFragment;
    const row = q<HTMLDivElement>(node, "[data-row]");

    const done = q<HTMLInputElement>(node, "[data-done]");
    const title = q<HTMLDivElement>(node, "[data-title]");
    const proj = q<HTMLSpanElement>(node, "[data-project]");
    const desc = q<HTMLDivElement>(node, "[data-desc]");
    const due = q<HTMLDivElement>(node, "[data-due]");

    done.checked = !!t.done;
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
        openEditor(full);
      } catch (err: any) {
        alert(String(err?.message ?? err));
      }
    });

    frag.appendChild(node);
  }

  listEl.appendChild(frag);
}

async function refresh() {
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

  on(newBtn, "click", () => openEditor());
  on(refreshBtn, "click", () => refresh());
  on(statusSel, "change", () => refresh());
  on(projectSel, "change", () => refresh());
  on(liveChk, "change", () => refresh());

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

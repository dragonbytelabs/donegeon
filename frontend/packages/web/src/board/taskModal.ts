import type { Engine } from "@donegeon/core";
import type { CardEntity } from "@donegeon/core";
import { donegeonDefs } from "../model/catalog";
import type { TaskDTO, ModifierSchema, ModalRefs, TaskModifierSlotDTO } from "../model/types";
import { updateCard } from "./immut";
import { scheduleLiveSync } from "./liveSync";
import { cmdTaskCompleteStack, cmdTaskSetTaskID, reloadBoard, sendCommand } from "./api";
import { notify } from "./notify";

function schemaFromModifiers(mods: TaskModifierSlotDTO[]): ModifierSchema {
  let showDueDate = false
  let showNextAction = false
  let showRecurrence = false
  mods.map(mod => {
    const defId = mod.defId
    switch (defId) {
      case "mod.deadline_pin":
        showDueDate = true
        break;
      case "mod.next_action":
        showNextAction = true
        break;
      case "mod.recurring_contract":
      case "mod.recurring":
        showRecurrence = true
        break;
      default:
        break;
    }
  })
  return {
    showDueDate,
    showNextAction,
    showRecurrence,
  };
}

function getStack(engine: Engine, stackId: string) {
  const s = engine.getStack(stackId);
  if (!s) throw new Error(`missing stack ${stackId}`);
  return s;
}

/** Find the top-most task card (face card rule). */
function findTaskFaceCard(engine: Engine, stackId: string): CardEntity {
  const s = getStack(engine, stackId);
  const cards = s.cards[0]();

  for (let i = cards.length - 1; i >= 0; i--) {
    const c = cards[i] as any;
    if (c?.def?.kind === "task") return c as CardEntity;
  }
  throw new Error("No task card in stack");
}

/** ✅ Find a card by id (for live editing / re-reading during modal). */
function findCardById(engine: Engine, stackId: string, cardId: string): CardEntity | null {
  const s = engine.getStack(stackId);
  if (!s) return null;
  const cards = s.cards[0]();
  const c = cards.find((x: any) => x?.id === cardId);
  return (c as CardEntity) ?? null;
}

function getModifierIdsFromStack(engine: Engine, stackId: string): TaskModifierSlotDTO[] {
  const modArray: TaskModifierSlotDTO[] = [];
  const s = getStack(engine, stackId);
  const cards = s.cards[0]();
  cards
    .filter(c => c.def.kind === "modifier")
    .map(c => String(c.def.id ?? "")) // "mod.deadline_pin"
    .filter(Boolean)
    .map(
      mod => {
        modArray.push({ defId: mod.startsWith("mod.") ? mod : `mod.${mod}`, data: {} });
      }
    ); // {"defId":"mod.deadline_pin","data":{}}

  return modArray
}

async function apiGetTask(id: string): Promise<TaskDTO> {
  const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`GET /api/tasks/${id} failed: ${res.status}`);
  return res.json();
}

async function parseTaskAPIError(res: Response, fallback: string): Promise<never> {
  let msg = fallback;
  try {
    const data = await res.json();
    if (data && typeof data.error === "string" && data.error.trim() !== "") {
      msg = data.error;
    }
  } catch {
    // keep fallback
  }
  throw new Error(msg);
}

async function apiCreateTask(input: Omit<TaskDTO, "id">): Promise<TaskDTO> {
  const res = await fetch(`/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseTaskAPIError(res, `POST /api/tasks failed: ${res.status}`);
  return res.json();
}

async function apiPatchTask(id: string, patch: Partial<Omit<TaskDTO, "id">>): Promise<TaskDTO> {
  const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) await parseTaskAPIError(res, `PATCH /api/tasks/${id} failed: ${res.status}`);
  return res.json();
}

function openTaskCalendarExport(taskId: string): void {
  const url = `/api/tasks/${encodeURIComponent(taskId)}/calendar.ics`;
  window.open(url, "_blank", "noopener");
}

function updateCalendarButtonState(r: ModalRefs, taskID?: string): void {
  const hasDueDate = !r.dueSection.classList.contains("hidden") && r.dueDate.value.trim() !== "";
  const ready = !!taskID && hasDueDate;
  r.btnCalendar.disabled = !ready;
  r.btnCalendar.classList.toggle("opacity-50", !ready);
  r.btnCalendar.classList.toggle("cursor-not-allowed", !ready);
  r.btnCalendar.title = ready
    ? "Export this task as an .ics calendar event"
    : "Set a due date and save first to export this task to calendar.";
}

function parseLockedFeature(message: string): string | null {
  const prefix = "feature locked:";
  const idx = message.indexOf(prefix);
  if (idx < 0) return null;
  return message.slice(idx + prefix.length).trim();
}

function withLockedFeatureRemoved(
  payload: Omit<TaskDTO, "id">,
  lockedFeature: string
): Omit<TaskDTO, "id"> {
  switch (lockedFeature) {
    case "task.due_date":
      return { ...payload, dueDate: undefined };
    case "task.next_action":
      return { ...payload, nextAction: false };
    case "task.recurrence":
      return { ...payload, recurrence: undefined };
    default:
      return payload;
  }
}

async function saveTaskWithLockFallback(
  existingTaskID: string | undefined,
  payload: Omit<TaskDTO, "id">
): Promise<TaskDTO> {
  let req = { ...payload };
  let lastErr: unknown = null;

  for (let i = 0; i < 4; i++) {
    try {
      if (existingTaskID) return await apiPatchTask(existingTaskID, req);
      return await apiCreateTask(req);
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message ?? e);
      const lockedFeature = parseLockedFeature(msg);
      if (!lockedFeature) throw e;

      const nextReq = withLockedFeatureRemoved(req, lockedFeature);
      const changed =
        nextReq.dueDate !== req.dueDate ||
        nextReq.nextAction !== req.nextAction ||
        JSON.stringify(nextReq.recurrence ?? null) !== JSON.stringify(req.recurrence ?? null);
      if (!changed) throw e;

      req = nextReq;
    }
  }

  throw lastErr ?? new Error("task save failed");
}

function modelFromCardData(data: any, mods: TaskModifierSlotDTO[]): Omit<TaskDTO, "id"> {
  const rec = data?.recurrence;
  const recurrence =
    rec &&
    typeof rec === "object" &&
    typeof rec.type === "string" &&
    rec.type.trim() !== "" &&
    Number(rec.interval) > 0
      ? {
          type: rec.type,
          interval: Number(rec.interval),
        }
      : undefined;

  return {
    title: typeof data?.title === "string" ? data.title : "",
    description: typeof data?.description === "string" ? data.description : "",
    done: !!data?.done,
    project: typeof data?.project === "string" ? data.project : "",
    tags: Array.isArray(data?.tags) ? data.tags.filter((t: any) => typeof t === "string") : [],
    modifiers: mods,
    dueDate: typeof data?.dueDate === "string" && data.dueDate.trim() !== "" ? data.dueDate : undefined,
    nextAction: !!data?.nextAction,
    recurrence,
  };
}

function mergeTaskOverCard(
  base: Omit<TaskDTO, "id">,
  taskModel: TaskDTO,
  mods: TaskModifierSlotDTO[]
): Omit<TaskDTO, "id"> {
  return {
    title: taskModel.title && taskModel.title.trim() !== "" ? taskModel.title : base.title,
    description:
      taskModel.description && taskModel.description.trim() !== ""
        ? taskModel.description
        : base.description,
    done: !!taskModel.done,
    project: taskModel.project ?? base.project,
    tags: Array.isArray(taskModel.tags) && taskModel.tags.length > 0 ? taskModel.tags : base.tags,
    modifiers: mods,
    dueDate: taskModel.dueDate ?? base.dueDate,
    nextAction: taskModel.nextAction || base.nextAction,
    recurrence: taskModel.recurrence ?? base.recurrence,
  };
}

let refs: ModalRefs | null = null;

let ctx:
  | {
    engine: Engine;
    stackId: string;
    cardId: string; // ✅ store id, not object
    existingTaskId?: string;
    mods: TaskModifierSlotDTO[];
    schema: ModifierSchema;
  }
  | null = null;

function q<T extends Element>(root: ParentNode, sel: string): T {
  const el = root.querySelector(sel);
  if (!el) throw new Error(`TaskModal missing element: ${sel}`);
  return el as T;
}

function ensureModalMounted() {
  if (refs) return refs;

  const overlay = document.getElementById("taskModalOverlay") as HTMLDivElement | null;
  const panel = document.getElementById("taskModalPanel") as HTMLDivElement | null;
  if (!overlay || !panel) {
    throw new Error("Task modal templ shell not found. Did you mount @TaskModalShell()?");
  }

  refs = {
    overlay,
    panel,
    title: q(panel, "[data-title]"),
    desc: q(panel, "[data-desc]"),
    done: q(panel, "[data-done]"),
    project: q(panel, "[data-project]"),
    tags: q(panel, "[data-tags]"),
    err: q(panel, "[data-error]"),
    mods: q(panel, "[data-modifiers]"),

    dueSection: q(panel, '[data-section="duedate"]'),
    dueDate: q(panel, "[data-duedate]"),

    nextSection: q(panel, '[data-section="nextaction"]'),
    nextAction: q(panel, "[data-nextaction]"),

    recSection: q(panel, '[data-section="recurrence"]'),
    recType: q(panel, "[data-rectype]"),
    recInv: q(panel, "[data-recinv]"),

    btnClose: q(panel, "[data-taskmodal-close]"),
    btnCalendar: document.createElement("button"),
    btnSave: q(panel, "[data-save]"),
  };

  refs.btnCalendar.type = "button";
  refs.btnCalendar.className =
    "rounded-lg border border-border bg-transparent px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed";
  refs.btnCalendar.textContent = "Calendar (.ics)";
  refs.btnSave.parentElement?.insertBefore(refs.btnCalendar, refs.btnSave);

  function close() {
    if (!refs) return;
    refs.overlay.classList.add("hidden");
    refs.overlay.classList.remove("flex");
    ctx = null;
  }

  refs.overlay.addEventListener("pointerdown", (e) => {
    if (e.target === refs!.overlay) close();
  });
  refs.btnClose.addEventListener("click", close);
  refs.btnCalendar.addEventListener("click", () => {
    if (!refs || !ctx) return;
    if (!ctx.existingTaskId) {
      refs.err.textContent = "Save this task first before exporting to calendar.";
      return;
    }
    if (refs.dueDate.value.trim() === "") {
      refs.err.textContent = "Set a due date before exporting to calendar.";
      return;
    }
    openTaskCalendarExport(ctx.existingTaskId);
  });
  refs.dueDate.addEventListener("input", () => {
    if (!refs) return;
    updateCalendarButtonState(refs, ctx?.existingTaskId);
  });

  refs.btnSave.addEventListener("click", async () => {
    if (!refs || !ctx) return;
    refs.err.textContent = "";

    // Ensure card still exists (important for your “edit during modal” plan)
    const liveCard = findCardById(ctx.engine, ctx.stackId, ctx.cardId);
    if (!liveCard) {
      refs.err.textContent = "This card no longer exists (stack changed while modal was open).";
      return;
    }

    const next: Omit<TaskDTO, "id"> = {
      title: refs.title.value.trim(),
      description: refs.desc.value.trim(),
      done: refs.done.checked,
      project: refs.project.value.trim() || undefined,
      tags: refs.tags.value.split(",").map((s) => s.trim()).filter(Boolean),

      modifiers: ctx.mods,

      dueDate: ctx.schema.showDueDate ? (refs.dueDate.value || undefined) : undefined,
      nextAction: ctx.schema.showNextAction ? refs.nextAction.checked : false,
      recurrence: ctx.schema.showRecurrence
        ? {
          type: refs.recType.value as any,
          interval: Math.max(1, Number(refs.recInv.value || "1")),
        }
        : undefined,
    };

    // Keep draft on the card until save succeeds (immutable)
    updateCard(ctx.engine, ctx.stackId, ctx.cardId, {
      recipe(d) {
        d.draft = next;
      },
    });

    try {
      const wasNewTask = !ctx.existingTaskId;
      // Persist core text fields to board first so reopen/refresh retains edits
      // even when task API rejects locked fields.
      await sendCommand("task.set_title", {
        taskCardId: ctx.cardId,
        title: next.title ?? "",
      });
      await sendCommand("task.set_description", {
        taskCardId: ctx.cardId,
        description: next.description ?? "",
      });

      const saved = await saveTaskWithLockFallback(ctx.existingTaskId, next);

      if (!ctx.existingTaskId) {
        // promote def + write all fields immutably (def is readonly)
        updateCard(ctx.engine, ctx.stackId, ctx.cardId, {
          nextDef: (donegeonDefs as any)["task.instance"],
          recipe(d) {
            d.taskId = saved.id;

            d.title = saved.title;
            d.description = saved.description;
            d.done = saved.done;
            d.project = saved.project;
            d.tags = saved.tags;

            d.modifiers = saved.modifiers;
            d.dueDate = saved.dueDate;
            d.nextAction = saved.nextAction;
            d.recurrence = saved.recurrence;

            delete d.draft;
          }});

        // keep ctx updated if you hit Save again while modal stays open
        ctx.existingTaskId = saved.id;
      } else {
        updateCard(ctx.engine, ctx.stackId, ctx.cardId, {
          recipe(d) {
            d.title = saved.title;
            d.description = saved.description;
            d.done = saved.done;
            d.project = saved.project;
            d.tags = saved.tags;

            d.modifiers = saved.modifiers;
            d.dueDate = saved.dueDate;
            d.nextAction = saved.nextAction;
            d.recurrence = saved.recurrence;

            delete d.draft;
          },
        });
      }

      updateCalendarButtonState(refs, ctx.existingTaskId);

      await cmdTaskSetTaskID(ctx.cardId, saved.id);

      if (saved.done) {
        await cmdTaskCompleteStack(ctx.stackId);
        await reloadBoard(ctx.engine);
        notify("Task completed", "success", 1700);
      } else if (wasNewTask) {
        notify("Task created", "success", 1500);
      } else {
        notify("Task updated", "info", 1300);
      }

      scheduleLiveSync(ctx.engine);

      close();
    } catch (e: any) {
      refs.err.textContent = String(e?.message ?? e);
    }
  });

  return refs;
}

export async function openTaskModal(opts: { engine: Engine; stackId: string; cardIndex?: number }) {
  const r = ensureModalMounted();

  const { engine, stackId } = opts;

  const face = findTaskFaceCard(engine, stackId);
  const mods = getModifierIdsFromStack(engine, stackId);
  const schema = schemaFromModifiers(mods);

  if (!face || face.def.kind !== "task") return;

  const data = (face.data ?? {}) as any;
  const existingTaskId = data.taskId as string | undefined;

  let model: Omit<TaskDTO, "id"> = modelFromCardData(data, mods);

  if (existingTaskId) {
    try {
      const t = await apiGetTask(existingTaskId);
      model = mergeTaskOverCard(model, t, mods);
    } catch {
      if (data.draft) model = { ...model, ...data.draft };
    }
  } else if (data.draft) {
    model = { ...model, ...data.draft };
  }

  // store open context for Save (store ids only)
  ctx = {
    engine,
    stackId,
    cardId: face.id,
    existingTaskId,
    mods,
    schema,
  };

  // hydrate inputs
  r.title.value = model.title ?? "";
  r.desc.value = model.description ?? "";
  r.done.checked = !!model.done;
  r.project.value = model.project ?? "";
  r.tags.value = (model.tags ?? []).join(", ");
  r.mods.textContent = mods.length ? `Modifiers: ${mods.map(m => m.defId.slice(4)).join(", ")}` : `Modifiers: (none)`;

  // toggle dynamic sections
  r.dueSection.classList.toggle("hidden", !schema.showDueDate);
  r.nextSection.classList.toggle("hidden", !schema.showNextAction);
  r.recSection.classList.toggle("hidden", !schema.showRecurrence);

  if (schema.showDueDate) r.dueDate.value = model.dueDate ?? "";
  if (schema.showNextAction) r.nextAction.checked = !!model.nextAction;
  if (schema.showRecurrence) {
    r.recType.value = (model.recurrence?.type ?? "weekly") as any;
    r.recInv.value = String(model.recurrence?.interval ?? 1);
  }

  r.err.textContent = "";
  updateCalendarButtonState(r, existingTaskId);

  // show modal
  r.overlay.classList.remove("hidden");
  r.overlay.classList.add("flex");
}

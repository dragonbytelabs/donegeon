import type { Engine } from "@donegeon/core";
import { CardEntity } from "@donegeon/core";
import { donegeonDefs } from "../model/catalog";
import type { TaskDTO, ModifierSchema, ModalRefs } from "../model/types";

function schemaFromModifiers(mods: string[]): ModifierSchema {
  return {
    showDueDate: mods.includes("deadline_pin"),
    showNextAction: mods.includes("next_action"),
    showRecurrence: mods.includes("recurring_contract") || mods.includes("recurring"),
  };
}

function getStack(engine: Engine, stackId: string) {
    const s = engine.getStack(stackId);
    if (!s) throw new Error(`missing stack ${stackId}`);
    return s;
}

function findTaskFaceCard(engine: Engine, stackId: string): CardEntity {
    const s = getStack(engine, stackId);
    const cards = s.cards[0]();

    // face card should be the top-most task card (you’re enforcing this)
    for (let i = cards.length - 1; i >= 0; i--) {
        const c = cards[i] as any;
        if (c?.def?.kind === "task") return c as CardEntity;
    }
    throw new Error("No task card in stack");
}

function getModifierIdsFromStack(engine: Engine, stackId: string): string[] {
    const s = getStack(engine, stackId);
    const cards = s.cards[0]();

    const mods = cards
        .filter((c: any) => c?.def?.kind === "modifier")
        .map((c: any) => String(c.def.id ?? "")) // e.g. "mod.deadline_pin"
        .filter(Boolean)
        .map((id) => id.startsWith("mod.") ? id.slice(4) : id); // => "deadline_pin"

    // enforce max 4 (you can also show an error)
    return mods.slice(0, 4);
}

function bumpStack(engine: Engine, stackId: string) {
    const s = engine.getStack(stackId);
    if (!s) return;
    // re-set same array to trigger reactive render if your core uses identity checks
    const cards = s.cards[0]();
    s.cards[1]([...cards]);
}

async function apiGetTask(id: string): Promise<TaskDTO> {
    const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`GET /api/tasks/${id} failed: ${res.status}`);
    return res.json();
}

async function apiCreateTask(input: Omit<TaskDTO, "id">): Promise<TaskDTO> {
    const res = await fetch(`/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`POST /api/tasks failed: ${res.status}`);
    return res.json();
}

async function apiPatchTask(id: string, patch: Partial<Omit<TaskDTO, "id">>): Promise<TaskDTO> {
    const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`PATCH /api/tasks/${id} failed: ${res.status}`);
    return res.json();
}

let refs: ModalRefs | null = null;

let ctx:
  | {
      engine: Engine;
      stackId: string;
      card: CardEntity;
      existingTaskId?: string;
      mods: string[];
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
  if (!overlay || !panel) throw new Error("Task modal templ shell not found. Did you mount @TaskModalShell()?");

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
    btnSave: q(panel, "[data-save]"),
  };

  function close() {
    if (!refs) return;
    refs.overlay.classList.add("hidden");
    refs.overlay.classList.remove("flex");
    ctx = null;
  }

  // click outside panel closes
  refs.overlay.addEventListener("pointerdown", (e) => {
    if (e.target === refs!.overlay) close();
  });
  refs.btnClose.addEventListener("click", close);

  refs.btnSave.addEventListener("click", async () => {
    if (!refs || !ctx) return;
    refs.err.textContent = "";

    const next: Omit<TaskDTO, "id"> = {
      title: refs.title.value.trim(),
      description: refs.desc.value.trim(),
      done: refs.done.checked,
      project: refs.project.value.trim() || undefined,
      tags: refs.tags.value.split(",").map(s => s.trim()).filter(Boolean),

      modifiers: ctx.mods,

      // dynamic fields:
      dueDate: ctx.schema.showDueDate ? (refs.dueDate.value || undefined) : undefined,
      nextAction: ctx.schema.showNextAction ? refs.nextAction.checked : false,
      recurrence: ctx.schema.showRecurrence
        ? { type: refs.recType.value as any, interval: Math.max(1, Number(refs.recInv.value || "1")) }
        : undefined,
    };

    // keep draft on the card until save succeeds
    (ctx.card.data).draft = next;
    bumpStack(ctx.engine, ctx.stackId);

    try {
      let saved: TaskDTO;

      if (!ctx.existingTaskId) {
        saved = await apiCreateTask(next);
        (ctx.card.data).taskId = saved.id;

        // promote def
        (ctx.card).def = (donegeonDefs)["task.instance"];
      } else {
        saved = await apiPatchTask(ctx.existingTaskId, next);
      }

      // store useful display fields on card
      (ctx.card.data).title = saved.title;
      (ctx.card.data).description = saved.description;
      (ctx.card.data).done = saved.done;
      (ctx.card.data).project = saved.project;
      (ctx.card.data).tags = saved.tags;
      (ctx.card.data).modifiers = saved.modifiers;
      (ctx.card.data).dueDate = saved.dueDate;
      (ctx.card.data).nextAction = saved.nextAction;
      (ctx.card.data).recurrence = saved.recurrence;

      delete (ctx.card.data).draft;

      bumpStack(ctx.engine, ctx.stackId);

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
  const card = findTaskFaceCard(engine, stackId);
  const mods = getModifierIdsFromStack(engine, stackId);
  const schema = schemaFromModifiers(mods);

  if (!card || card.def.kind !== "task") return;

  const data = (card.data ?? {}) as any;
  const existingTaskId = data.taskId as string | undefined;

  let model: Omit<TaskDTO, "id"> = {
    title: "",
    description: "",
    done: false,
    project: "",
    tags: [],
    modifiers: mods,
    dueDate: undefined,
    nextAction: false,
    recurrence: undefined,
  };

  if (existingTaskId) {
    try {
      const t = await apiGetTask(existingTaskId);
      model = {
        title: t.title ?? "",
        description: t.description ?? "",
        done: !!t.done,
        project: t.project ?? "",
        tags: t.tags ?? [],
        modifiers: mods,
        dueDate: t.dueDate,
        nextAction: !!t.nextAction,
        recurrence: t.recurrence,
      };
    } catch {
      if (data.draft) model = { ...model, ...data.draft };
    }
  } else if (data.draft) {
    model = { ...model, ...data.draft };
  }

  // store open context for Save
  ctx = { engine, stackId, card, existingTaskId, mods, schema };

  // hydrate inputs
  r.title.value = model.title ?? "";
  r.desc.value = model.description ?? "";
  r.done.checked = !!model.done;
  r.project.value = model.project ?? "";
  r.tags.value = (model.tags ?? []).join(", ");
  r.mods.textContent = mods.length ? `Modifiers: ${mods.join(", ")}` : `Modifiers: (none)`;

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

  // show modal
  r.overlay.classList.remove("hidden");
  r.overlay.classList.add("flex");
}
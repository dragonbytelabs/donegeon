import type { Engine } from "../../../../frontend/packages/core";
import { CardEntity } from "../../../../frontend/packages/core";
import { donegeonDefs } from "../model/catalog"; // or wherever you export it

type TaskDTO = {
  id: string;
  title: string;
  description: string;
  done: boolean;
  project?: string;
  tags: string[];
};

function getCard(engine: Engine, stackId: string, cardIndex?: number): CardEntity | null {
  const s = engine.getStack(stackId);
  if (!s) return null;

  const cards = s.cards[0]();
  if (typeof cardIndex === "number") {
    return (cards[cardIndex] as any) ?? null;
  }

  return (s.topCard() as any) ?? null;
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

export async function openTaskModal(opts: { engine: Engine; stackId: string; cardIndex?: number }) {
  const { engine, stackId, cardIndex } = opts;
  const card = getCard(engine, stackId, cardIndex);
  if (!card || card.def.kind !== "task") return;

  // Local draft lives on the card until Save
  const data = (card.data ?? {}) as any;
  const existingTaskId = data.taskId as string | undefined;

  let model: Omit<TaskDTO, "id"> = {
    title: "",
    description: "",
    done: false,
    project: "",
    tags: [],
  };

  if (existingTaskId) {
    try {
      const t = await apiGetTask(existingTaskId);
      model = { ...t, project: t.project ?? "", tags: t.tags ?? [] };
      delete (model as any).id;
    } catch {
      // fallback to draft
      if (data.draft) model = { ...model, ...data.draft };
    }
  } else if (data.draft) {
    model = { ...model, ...data.draft };
  }

  // ----- DOM modal -----
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,.55)";
  overlay.style.zIndex = "9999";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";

  const panel = document.createElement("div");
  panel.style.width = "min(720px, 92vw)";
  panel.style.maxHeight = "85vh";
  panel.style.overflow = "auto";
  panel.style.background = "rgba(20,20,22,.98)";
  panel.style.border = "1px solid rgba(255,255,255,.12)";
  panel.style.borderRadius = "16px";
  panel.style.padding = "16px";
  panel.style.color = "white";

  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;">
      <div style="font-weight:700;">Task</div>
      <button data-x style="border:1px solid rgba(255,255,255,.15);background:transparent;border-radius:10px;padding:6px 10px;cursor:pointer;">Close</button>
    </div>

    <label style="display:block;margin:10px 0 6px;">Title</label>
    <input data-title style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:white;" />

    <label style="display:block;margin:10px 0 6px;">Description</label>
    <textarea data-desc rows="5" style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:white;"></textarea>

    <div style="display:flex;gap:12px;align-items:center;margin-top:10px;">
      <label style="display:flex;gap:8px;align-items:center;">
        <input data-done type="checkbox" />
        Done
      </label>

      <div style="flex:1;"></div>

      <button data-save style="border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);border-radius:10px;padding:8px 12px;cursor:pointer;">Save</button>
    </div>

    <label style="display:block;margin:10px 0 6px;">Project (optional)</label>
    <input data-project style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:white;" />

    <label style="display:block;margin:10px 0 6px;">Tags (comma-separated)</label>
    <input data-tags style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:white;" />

    <div data-error style="margin-top:10px;color:#ffb4b4;white-space:pre-wrap;"></div>
  `;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  const $ = <T extends HTMLElement>(sel: string) => panel.querySelector(sel) as T;
  const titleEl = $<HTMLInputElement>("[data-title]");
  const descEl = $<HTMLTextAreaElement>("[data-desc]");
  const doneEl = $<HTMLInputElement>("[data-done]");
  const projEl = $<HTMLInputElement>("[data-project]");
  const tagsEl = $<HTMLInputElement>("[data-tags]");
  const errEl = $<HTMLDivElement>("[data-error]");

  titleEl.value = model.title ?? "";
  descEl.value = model.description ?? "";
  doneEl.checked = !!model.done;
  projEl.value = model.project ?? "";
  tagsEl.value = (model.tags ?? []).join(", ");

  function close() {
    overlay.remove();
  }

  overlay.addEventListener("pointerdown", (e) => {
    if (e.target === overlay) close();
  });

  $<HTMLButtonElement>("[data-x]").addEventListener("click", close);

  $<HTMLButtonElement>("[data-save]").addEventListener("click", async () => {
    errEl.textContent = "";

    const next: Omit<TaskDTO, "id"> = {
      title: titleEl.value.trim(),
      description: descEl.value.trim(),
      done: doneEl.checked,
      project: projEl.value.trim() || undefined,
      tags: tagsEl.value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    // Always keep the draft on the card until Save succeeds
    (card.data as any).draft = next;
    bumpStack(engine, stackId);

    try {
      let saved: TaskDTO;
      if (!existingTaskId) {
        saved = await apiCreateTask(next); // CREATE ONLY HERE
        (card.data as any).taskId = saved.id;

        // Promote card def to task.instance (Option 1)
        (card as any).def = (donegeonDefs as any)["task.instance"];
      } else {
        saved = await apiPatchTask(existingTaskId, next);
      }

      // Put useful display data on the card (so board title shows without fetch)
      (card.data as any).title = saved.title;
      (card.data as any).description = saved.description;
      (card.data as any).done = saved.done;
      (card.data as any).project = saved.project;
      (card.data as any).tags = saved.tags;

      // draft is no longer needed once persisted
      delete (card.data as any).draft;

      bumpStack(engine, stackId);
      close();
    } catch (e: any) {
      errEl.textContent = String(e?.message ?? e);
    }
  });
}

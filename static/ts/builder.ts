import { ActionType, CardDef } from "./model.js";

const STORE_KEY = "cleartify.carddefs";

const ACTIONS: { type: ActionType; label: string }[] = [
  { type: "event.formSubmit", label: "Event: Form Submit" },
  { type: "agent.ai", label: "Agent: AI" },
  { type: "rule.ifElse", label: "Rule: If/Else" },
  { type: "tool.entraLookup", label: "Tool: Entra Lookup" },
  { type: "tool.jiraCreateUser", label: "Tool: Jira Create User" },
  { type: "action.slackInvite", label: "Action: Slack Invite" },
  { type: "action.slackUpdateProfile", label: "Action: Slack Update Profile" },
  { type: "memory.postgres", label: "Memory: Postgres" },
];

function $(id: string) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

function uid(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function loadAll(): CardDef[] {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveAll(cards: CardDef[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(cards, null, 2));
}

let draft: CardDef = {
  id: uid("card"),
  title: "New Card",
  icon: "⬤",
  kindClass: "sl-kind-blank",
  ports: [{ id: "in", side: "left" }, { id: "out", side: "right" }],
  actions: [],
};

function renderLibrary() {
  const host = $("actionLibrary");
  host.innerHTML = "";
  for (const a of ACTIONS) {
    const chip = document.createElement("div");
    chip.className =
      "cursor-grab select-none rounded-md border border-border bg-card px-2 py-2 text-sm hover:bg-accent";
    chip.textContent = a.label;
    chip.draggable = true;
    chip.dataset.actionType = a.type;
    chip.addEventListener("dragstart", (e) => {
      e.dataTransfer?.setData("text/actionType", a.type);
    });
    host.appendChild(chip);
  }
}

function renderPreview() {
  const host = $("cardPreviewHost");
  host.innerHTML = "";

  const card = document.createElement("div");
  card.className = `sl-card ${draft.kindClass}`;
  card.style.position = "relative";
  card.style.width = "92px";
  card.style.height = "124px";

  card.innerHTML = `
    <div class="sl-card__title">${draft.title}</div>
    <div class="sl-card__body">
      <div class="sl-card__icon"><span style="font-size:18px;opacity:.85">${draft.icon}</span></div>
    </div>
  `;

  // drop target behavior
  card.addEventListener("dragover", (e) => e.preventDefault());
  card.addEventListener("drop", (e) => {
    e.preventDefault();
    const t = e.dataTransfer?.getData("text/actionType") as ActionType;
    if (!t) return;
    draft.actions.push({ type: t });
    renderActions();
  });

  host.appendChild(card);
}

function renderActions() {
  const host = $("cardActions");
  host.innerHTML = "";
  draft.actions.forEach((a, idx) => {
    const row = document.createElement("div");
    row.className = "flex items-center justify-between rounded-md border border-border bg-card px-2 py-1 text-xs";
    row.innerHTML = `<span>${a.type}</span>`;
    const rm = document.createElement("button");
    rm.className = "rounded-md px-2 py-1 hover:bg-accent";
    rm.textContent = "Remove";
    rm.addEventListener("click", () => {
      draft.actions.splice(idx, 1);
      renderActions();
    });
    row.appendChild(rm);
    host.appendChild(row);
  });
}

function bindInputs() {
  const title = $("cardTitle") as HTMLInputElement;
  const icon = $("cardIcon") as HTMLInputElement;
  const kind = $("cardKind") as HTMLSelectElement;

  title.value = draft.title;
  icon.value = draft.icon;
  kind.value = draft.kindClass;

  title.addEventListener("input", () => {
    draft.title = title.value;
    renderPreview();
  });
  icon.addEventListener("input", () => {
    draft.icon = icon.value;
    renderPreview();
  });
  kind.addEventListener("change", () => {
    draft.kindClass = kind.value;
    renderPreview();
  });

  $("saveCard").addEventListener("click", () => {
    const all = loadAll();
    all.push({ ...draft, actions: [...draft.actions], ports: [...draft.ports] });
    saveAll(all);
    draft = { ...draft, id: uid("card") };
    title.value = draft.title;
    renderPreview();
    renderActions();
  });

  $("exportCards").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(loadAll(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cleartify-cards.json";
    a.click();
    URL.revokeObjectURL(url);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderLibrary();
  renderPreview();
  renderActions();
  bindInputs();
});

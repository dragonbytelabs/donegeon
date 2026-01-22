type MenuItem = { label: string; onClick: () => void; disabled?: boolean };

let menuEl: HTMLDivElement | null = null;

function ensureMenu(root: HTMLElement) {
  if (menuEl) return menuEl;

  menuEl = document.createElement("div");
  menuEl.id = "ctxMenu";
  menuEl.className =
    "fixed z-[9999] hidden min-w-[160px] overflow-hidden rounded-xl border border-border bg-card/90 text-foreground shadow-lg backdrop-blur";
  menuEl.innerHTML = `<div class="p-1" data-body></div>`;
  document.body.appendChild(menuEl);

  // click outside closes
  window.addEventListener("pointerdown", (e) => {
    if (!menuEl || menuEl.classList.contains("hidden")) return;
    const t = e.target as HTMLElement;
    if (t.closest("#ctxMenu")) return;
    hideContextMenu();
  });

  // escape closes
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideContextMenu();
  });

  return menuEl;
}

export function showContextMenu(opts: {
  root: HTMLElement;
  clientX: number;
  clientY: number;
  items: MenuItem[];
}) {
  const el = ensureMenu(opts.root);
  const body = el.querySelector("[data-body]") as HTMLDivElement;

  body.innerHTML = "";
  for (const item of opts.items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent";
    btn.textContent = item.label;
    btn.disabled = !!item.disabled;
    btn.addEventListener("click", () => {
      hideContextMenu();
      item.onClick();
    });
    body.appendChild(btn);
  }

  // position: keep on-screen
  el.classList.remove("hidden");
  const pad = 8;
  const { innerWidth: W, innerHeight: H } = window;
  const rect = el.getBoundingClientRect();
  let x = opts.clientX;
  let y = opts.clientY;

  if (x + rect.width + pad > W) x = W - rect.width - pad;
  if (y + rect.height + pad > H) y = H - rect.height - pad;
  if (x < pad) x = pad;
  if (y < pad) y = pad;

  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

export function hideContextMenu() {
  if (!menuEl) return;
  menuEl.classList.add("hidden");
}

// board/render.ts
import { createEffect } from "@donegeon/core";
import type { Engine } from "@donegeon/core";
import type { StackEntity } from "@donegeon/core";

const CARD_W = 92;
const CARD_H = 124;
const STACK_OFFSET_Y = 20;

function stackHeight(n: number) {
  return CARD_H + Math.max(0, n - 1) * STACK_OFFSET_Y;
}

function getCardTemplate(): HTMLTemplateElement {
  const tpl = document.getElementById("slCardTpl") as HTMLTemplateElement | null;
  if (!tpl) throw new Error(`Missing #slCardTpl. Did you mount @SLCardTemplate() in Board.templ?`);
  return tpl;
}

function fillCardNode(cardRoot: HTMLElement, opts: {
  skinClass: string;
  isTop: boolean;
  cardIndex: number;
  title: string;
  icon: string;
  showInfo: boolean;
  leftBadge?: string;
  rightBadge?: string;
}) {
  cardRoot.className = `sl-card ${opts.skinClass}` + (opts.isTop ? " sl-top" : "");
  (cardRoot.parentElement as HTMLElement | null)?.classList.remove("sl-top"); // safe, no-op

  // dataset
  (cardRoot as any).dataset.cardIndex = String(opts.cardIndex);

  const titleEl = cardRoot.querySelector('[data-slot="title"]') as HTMLElement | null;
  if (titleEl) titleEl.textContent = opts.title;

  const iconEl = cardRoot.querySelector('[data-slot="icon"]') as HTMLElement | null;
  if (iconEl) iconEl.textContent = opts.icon;

  const infoBtn = cardRoot.querySelector('[data-action="task-info"]') as HTMLButtonElement | null;
  if (infoBtn) {
    infoBtn.style.display = opts.showInfo ? "" : "none";
    // prevent drag starting from button
    infoBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  }

  const left = cardRoot.querySelector('[data-slot="leftBadge"]') as HTMLElement | null;
  if (left) {
    if (opts.leftBadge) {
      left.textContent = opts.leftBadge;
      left.classList.remove("hidden");
    } else {
      left.textContent = "";
      left.classList.add("hidden");
    }
  }

  const right = cardRoot.querySelector('[data-slot="rightBadge"]') as HTMLElement | null;
  if (right) {
    if (opts.rightBadge) {
      right.textContent = opts.rightBadge;
      right.classList.remove("hidden");
    } else {
      right.textContent = "";
      right.classList.add("hidden");
    }
  }
}

export function mountBoard(engine: Engine, boardEl: HTMLElement) {
  const mounted = new Map<string, { node: HTMLElement; dispose: () => void }>();

  createEffect(() => {
    const ids = engine.stackIds[0]();

    for (const [id, m] of Array.from(mounted.entries())) {
      if (!ids.includes(id)) {
        m.dispose();
        m.node.remove();
        mounted.delete(id);
      }
    }

    for (const id of ids) {
      if (mounted.has(id)) continue;
      const s = engine.getStack(id);
      if (!s) continue;

      const m = mountStack(s);
      mounted.set(id, m);
      boardEl.appendChild(m.node);
    }
  });

  return mounted;
}

function mountStack(s: StackEntity) {
  const node = document.createElement("div");
  node.className = "sl-stack";
  node.dataset.stackId = s.id;
  node.style.position = "absolute";
  node.style.overflow = "visible";
  node.style.touchAction = "none";

  const tpl = getCardTemplate();
  const disposers: Array<() => void> = [];

  disposers.push(
    createEffect(() => {
      const p = s.pos[0]();
      node.style.left = `${p.x}px`;
      node.style.top = `${p.y}px`;
    })
  );

  disposers.push(
    createEffect(() => {
      node.style.zIndex = String(s.z[0]());
    })
  );

  disposers.push(
    createEffect(() => {
      const cards = s.cards[0]();

      node.style.width = `${CARD_W}px`;
      node.style.height = `${stackHeight(cards.length)}px`;
      node.innerHTML = "";

      cards.forEach((c, idx) => {
        const isTop = idx === cards.length - 1;
        const draft = (c.data as any)?.draft as any | undefined;

        const title =
          (c.def.id === "task.instance" && ((c.data as any)?.title as string | undefined)) ||
          (draft?.title as string | undefined) ||
          c.title;

        const showInfo = c.def.kind === "task";

        // clone template
        const frag = tpl.content.cloneNode(true) as DocumentFragment;
        const el = frag.firstElementChild as HTMLElement;

        // position (wrapper stays the same)
        el.style.position = "absolute";
        el.style.left = "0px";
        el.style.top = `${idx * STACK_OFFSET_Y}px`;
        (el as any).dataset.cardIndex = String(idx);

        fillCardNode(el, {
          skinClass: c.skinClass,
          isTop,
          cardIndex: idx,
          title,
          icon: c.icon,
          showInfo,
          leftBadge: c.def.leftBadge || "",
          rightBadge: c.def.rightBadge || "",
        });

        node.appendChild(el);
      });
    })
  );

  return {
    node,
    dispose: () => {
      for (const d of disposers) d();
      disposers.length = 0;
    },
  };
}

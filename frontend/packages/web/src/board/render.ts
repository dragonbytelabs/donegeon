import { createEffect } from "../core/reactivity";
import type { Engine } from "../model/engine";
import type { StackEntity } from "../model/stack";
import { type Mounted } from "../model/types";

const CARD_W = 92;
const CARD_H = 124;
const STACK_OFFSET_Y = 20;

function stackHeight(n: number) {
  return CARD_H + Math.max(0, n - 1) * STACK_OFFSET_Y;
}

export function mountBoard(engine: Engine, boardEl: HTMLElement) {
  const mounted = new Map<string, Mounted>();

  // Mount/unmount based on engine.stackIds signal
  createEffect(() => {
    const ids = engine.stackIds[0]();

    // remove missing
    for (const [id, m] of Array.from(mounted.entries())) {
      if (!ids.includes(id)) {
        m.dispose();
        m.node.remove();
        mounted.delete(id);
      }
    }

    // add new
    for (const id of ids) {
      if (mounted.has(id)) continue;
      const s = engine.stacks.get(id);
      if (!s) continue;

      const m = mountStack(engine, s);
      mounted.set(id, m);
      boardEl.appendChild(m.node);
    }
  });

  return mounted;
}

function mountStack(engine: Engine, s: StackEntity): Mounted {
  const node = document.createElement("div");
  node.className = "sl-stack";
  node.dataset.stackId = s.id;
  node.style.position = "absolute";
  node.style.overflow = "visible";
  node.style.touchAction = "none";

  const disposers: Array<() => void> = [];

  // position
  disposers.push(
    createEffect(() => {
      const p = s.pos[0]();
      node.style.left = `${p.x}px`;
      node.style.top = `${p.y}px`;
    })
  );

  // z
  disposers.push(
    createEffect(() => {
      node.style.zIndex = String(s.z[0]());
    })
  );

  // cards (rebuild when array changes)
  disposers.push(
    createEffect(() => {
      const cards = s.cards[0]();
      node.style.width = `${CARD_W}px`;
      node.style.height = `${stackHeight(cards.length)}px`;
      node.innerHTML = "";

      cards.forEach((c, idx) => {
        const isTop = idx === cards.length - 1;
        const el = document.createElement("div");
        el.className = `sl-card ${c.def.skinClass}` + (isTop ? " sl-top" : "");
        el.dataset.cardIndex = String(idx);
        el.style.position = "absolute";
        el.style.left = "0px";
        el.style.top = `${idx * STACK_OFFSET_Y}px`;

        // allow clicking middle cards for shift-split
        // (if you want non-top cards to be "harder" to grab later, we can tweak UX)
        el.innerHTML = `
          <div class="sl-card__title">${c.def.title}</div>
          <div class="sl-card__body">
            <div class="sl-card__icon"><span style="font-size:18px;opacity:.85">${c.def.icon}</span></div>
          </div>
          ${c.def.leftBadge ? `<div class="sl-badge sl-badge--left">${c.def.leftBadge}</div>` : ""}
          ${c.def.rightBadge ? `<div class="sl-badge sl-badge--right">${c.def.rightBadge}</div>` : ""}
        `;
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

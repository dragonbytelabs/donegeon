type ActiveBar = {
  done: boolean;
  raf: number;
  root: HTMLDivElement;
  fill: HTMLDivElement;
  label: HTMLDivElement;
};

const activeBars = new Map<string, ActiveBar>();

function stackNodeById(stackId: string): HTMLElement | null {
  return document.querySelector(`.sl-stack[data-stack-id="${stackId}"]`) as HTMLElement | null;
}

function makeBar(label: string): ActiveBar {
  const root = document.createElement("div");
  root.style.position = "absolute";
  root.style.left = "4px";
  root.style.right = "4px";
  root.style.bottom = "-16px";
  root.style.height = "12px";
  root.style.borderRadius = "6px";
  root.style.border = "1px solid rgba(56,189,248,.6)";
  root.style.background = "rgba(15,23,42,.95)";
  root.style.overflow = "hidden";
  root.style.pointerEvents = "none";
  root.style.boxShadow = "0 2px 10px rgba(0,0,0,.35)";
  root.style.zIndex = "20";

  const fill = document.createElement("div");
  fill.style.position = "absolute";
  fill.style.left = "0";
  fill.style.top = "0";
  fill.style.bottom = "0";
  fill.style.width = "0%";
  fill.style.background = "linear-gradient(90deg, rgba(56,189,248,.95), rgba(34,197,94,.95))";
  fill.style.transition = "width .09s linear";
  root.appendChild(fill);

  const text = document.createElement("div");
  text.textContent = label;
  text.style.position = "absolute";
  text.style.left = "0";
  text.style.right = "0";
  text.style.top = "50%";
  text.style.transform = "translateY(-50%)";
  text.style.textAlign = "center";
  text.style.fontSize = "9px";
  text.style.fontWeight = "700";
  text.style.color = "#e2e8f0";
  text.style.textTransform = "uppercase";
  text.style.letterSpacing = ".03em";
  root.appendChild(text);

  return { done: false, raf: 0, root, fill, label: text };
}

export function clearStackActivity(stackId: string): void {
  const existing = activeBars.get(stackId);
  if (!existing) return;
  existing.done = true;
  if (existing.raf) cancelAnimationFrame(existing.raf);
  existing.root.remove();
  activeBars.delete(stackId);
}

export function startStackActivity(stackId: string, label: string, durationMs: number): Promise<void> {
  clearStackActivity(stackId);

  const node = stackNodeById(stackId);
  if (!node) return Promise.resolve();
  if (getComputedStyle(node).position === "static") {
    node.style.position = "absolute";
  }

  const activity = makeBar(label);
  node.appendChild(activity.root);
  activeBars.set(stackId, activity);

  const startedAt = performance.now();
  const clampedDuration = Math.max(300, durationMs);

  return new Promise<void>((resolve) => {
    const tick = (now: number) => {
      if (activity.done) {
        resolve();
        return;
      }
      const elapsed = now - startedAt;
      const pct = Math.max(0, Math.min(100, (elapsed / clampedDuration) * 100));
      activity.fill.style.width = `${pct.toFixed(1)}%`;
      if (elapsed >= clampedDuration) {
        clearStackActivity(stackId);
        resolve();
        return;
      }
      activity.raf = requestAnimationFrame(tick);
    };
    activity.raf = requestAnimationFrame(tick);
  });
}

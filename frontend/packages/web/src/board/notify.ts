type NoticeLevel = "success" | "info" | "warn" | "error";

let rootEl: HTMLDivElement | null = null;

function ensureRoot(): HTMLDivElement {
  if (rootEl) return rootEl;
  const el = document.createElement("div");
  el.id = "donegeon-toast-root";
  el.style.position = "fixed";
  el.style.top = "60px";
  el.style.right = "14px";
  el.style.zIndex = "9999";
  el.style.display = "flex";
  el.style.flexDirection = "column";
  el.style.gap = "8px";
  el.style.pointerEvents = "none";
  document.body.appendChild(el);
  rootEl = el;
  return el;
}

function styleFor(level: NoticeLevel): { bg: string; border: string } {
  switch (level) {
    case "success":
      return { bg: "rgba(22,101,52,.92)", border: "rgba(74,222,128,.65)" };
    case "warn":
      return { bg: "rgba(120,53,15,.92)", border: "rgba(251,191,36,.65)" };
    case "error":
      return { bg: "rgba(127,29,29,.94)", border: "rgba(248,113,113,.7)" };
    default:
      return { bg: "rgba(31,41,55,.94)", border: "rgba(148,163,184,.55)" };
  }
}

export function notify(message: string, level: NoticeLevel = "info", timeoutMs = 2600): void {
  const root = ensureRoot();
  const toast = document.createElement("div");
  const palette = styleFor(level);

  toast.textContent = message;
  toast.style.minWidth = "220px";
  toast.style.maxWidth = "340px";
  toast.style.padding = "10px 12px";
  toast.style.borderRadius = "10px";
  toast.style.border = `1px solid ${palette.border}`;
  toast.style.background = palette.bg;
  toast.style.color = "#f8fafc";
  toast.style.fontSize = "12px";
  toast.style.fontWeight = "600";
  toast.style.lineHeight = "1.35";
  toast.style.letterSpacing = ".01em";
  toast.style.pointerEvents = "none";
  toast.style.opacity = "0";
  toast.style.transform = "translateY(-4px)";
  toast.style.transition = "opacity .14s ease, transform .14s ease";
  root.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-4px)";
    window.setTimeout(() => {
      toast.remove();
      if (root.children.length === 0 && root.parentElement) {
        root.parentElement.removeChild(root);
        rootEl = null;
      }
    }, 160);
  }, Math.max(800, timeoutMs));
}

export type { NoticeLevel };

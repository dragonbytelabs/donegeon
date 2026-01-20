import { DOT_PHASE, GRID } from "./constants";

export function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

export function boardEl(): HTMLElement {
  return $("board");
}

export function applyPan(panX: number, panY: number) {
  boardEl().style.transform = `translate(${panX}px, ${panY}px)`;
}

export function boardRect(): DOMRect {
  return boardEl().getBoundingClientRect();
}

export function clientToBoard(clientX: number, clientY: number) {
  const br = boardRect();
  return { x: clientX - br.left, y: clientY - br.top };
}

export function snapToGrid(x: number, y: number) {
  const sx = Math.round((x - DOT_PHASE) / GRID) * GRID + DOT_PHASE;
  const sy = Math.round((y - DOT_PHASE) / GRID) * GRID + DOT_PHASE;
  return { x: sx, y: sy };
}

export function rect(el: HTMLElement) {
  return el.getBoundingClientRect();
}

export function intersectArea(a: DOMRect, b: DOMRect) {
  const x1 = Math.max(a.left, b.left);
  const y1 = Math.max(a.top, b.top);
  const x2 = Math.min(a.right, b.right);
  const y2 = Math.min(a.bottom, b.bottom);
  const w = x2 - x1;
  const h = y2 - y1;
  return w > 0 && h > 0 ? w * h : 0;
}

export function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function uid(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export type Pan = { x: number; y: number };

let pan: Pan = { x: 0, y: 0 };

export function getPan(): Pan {
  return pan;
}

export function setPan(x: number, y: number) {
  pan = { x, y };
}

export function applyPan(boardEl: HTMLElement) {
  const p = pan;
  boardEl.style.transform = `translate(${p.x}px, ${p.y}px)`;
}

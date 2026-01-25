export type DragState = { stackId: string; pointerId: number; offX: number; offY: number };

export type PressState = {
  pointerId: number;
  startX: number;
  startY: number;
  timer: number;
  stackId: string;
  cardIndex?: number;
};

export type PanState = {
  active: boolean;
  pointers: Map<number, { x: number; y: number }>;
  lastMid?: { x: number; y: number };
};

export type Mounted = {
  node: HTMLElement;
  dispose: () => void;
};

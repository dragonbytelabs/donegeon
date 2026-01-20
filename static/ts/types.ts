export type CardKind =
  | "sl-kind-wood"
  | "sl-kind-stone"
  | "sl-kind-coin"
  | "sl-kind-quest"
  | "sl-kind-food"
  | "sl-kind-blank";

export type Card = {
  id: string;
  kind: CardKind;
  title: string;
  icon?: string;
  leftBadge?: string;
  rightBadge?: string;
};

export type Stack = {
  id: string;
  x: number;
  y: number;
  cards: Card[]; // bottom -> top
};

export type DragState = { stackId: string; pointerId: number; offX: number; offY: number };

export type PressState = {
  stackId: string;
  cardIndex?: number;
  pointerId: number;
  startX: number;
  startY: number;
  timer: number;
};

import type { EntityId } from "../core/ids";

export type Point = { x: number; y: number };

export type CardKind =
  | "event"
  | "agent"
  | "rule"
  | "integration"
  | "action"
  | "memory"
  | "resource"
  | "blank";

export type CardDefId = string;

/**
 * A card definition is the template/blueprint (what you’ll build in /builder later).
 * Instances (CardEntity) reference a def.
 */
export type CardDef = {
  id: CardDefId;
  kind: CardKind;
  title: string;
  icon: string;

  // maps to Tailwind / your card skin classes (Stacklands look)
  skinClass: string;

  // optional badges (or “stats”) you render in corners
  leftBadge?: string;
  rightBadge?: string;
};

/**
 * Runtime instance data (payload). For example:
 * event form submission fields, agent config, rule config, etc.
 */
export type CardData = Record<string, unknown>;

export type StackId = EntityId;
export type CardId = EntityId;

export type DragState = {
  stackId: string;
  pointerId: number;
  offX: number;
  offY: number;
};

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

export type Pan = { x: number; y: number };
import type { EntityId } from "../core/ids";

export type Point = { x: number; y: number };
export type Pan = { x: number; y: number };

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

export type CardDef = {
  id: CardDefId;
  kind: CardKind;
  title: string;
  icon: string;
  skin: string;
  leftBadge?: string;
  rightBadge?: string;
};

export type CardData = Record<string, unknown>;

export type StackId = EntityId;
export type CardId = EntityId;



import type { EntityId } from "../core/ids";

export type Point = { x: number; y: number };
export type Pan = { x: number; y: number };

export type CardDefId = string;

export type CardDef<K extends string = string> = {
  id: CardDefId;
  kind: K;
  title: string;
  icon: string;
  skin: string;
  leftBadge?: string;
  rightBadge?: string;
};

export type CardData = Record<string, unknown>;

export type StackId = EntityId;
export type CardId = EntityId;



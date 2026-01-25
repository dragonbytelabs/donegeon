import { getRuntime } from "./runtime";

export type EntityId = string;

export function uid(prefix: string): EntityId {
  const { randomUUID } = getRuntime();
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}



export type EntityId = string;

export function uid(prefix: string): EntityId {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

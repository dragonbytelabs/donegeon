import type { Stack } from "./types";

export function topKind(s: Stack): string {
  return s.cards[s.cards.length - 1]?.kind ?? "";
}

export function canMergeStacks(a: Stack, b: Stack): boolean {
  return topKind(a) === topKind(b);
}

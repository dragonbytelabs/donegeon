import type { Stack } from "./types";

export let nextZ = 10;
export const stacks = new Map<string, Stack>();

export let panX = 0;
export let panY = 0;

export function incrementZ(): number {
  return nextZ++;
}

export function setPan(x: number, y: number) {
  panX = x;
  panY = y;
}

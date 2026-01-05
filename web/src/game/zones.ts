export type ZoneId = "table" | "inbox_pile" | "live_pile" | "graveyard" | "recycle";

export type ZoneDef = {
  id: ZoneId;
  title: string;
  hint: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export const ZONES: ZoneDef[] = [
  {
    id: "inbox_pile",
    title: "Inbox Pile",
    hint: "Drop here to stack tasks",
    x: 20,
    y: 90,
    w: 220,
    h: 220,
  },
  {
    id: "live_pile",
    title: "Live Pile",
    hint: "Later: drop here → /api/tasks/process",
    x: 20,
    y: 330,
    w: 220,
    h: 220,
  },
  {
    id: "graveyard",
    title: "Complete Task",
    hint: "Drop here to complete & earn rewards",
    x: 20,
    y: 570,
    w: 220,
    h: 220,
  },
  {
    id: "recycle",
    title: "♻️ Recycle",
    hint: "Drop cards here for coins",
    x: 1140,
    y: 570,
    w: 220,
    h: 220,
  },
];

// where a snapped card goes inside its zone based on stack index
export function pilePlacement(zone: ZoneDef, index: number) {
  // nice “stack” offset; tweak these for vibe
  const dx = 6;
  const dy = 5;

  const x = zone.x + 14 + index * dx;
  const y = zone.y + 14 + index * dy;

  // subtle fan rotation
  const rot = ((index % 7) - 3) * 1.6; // -4.8..+4.8 deg
  return { x, y, rot };
}

export function hitTestZone(cx: number, cy: number): ZoneDef | null {
  for (const z of ZONES) {
    if (cx >= z.x && cx <= z.x + z.w && cy >= z.y && cy <= z.y + z.h) return z;
  }
  return null;
}

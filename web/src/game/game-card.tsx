import { css } from "@linaria/core";
import { useRef } from "react";
import type { GameCardModel } from "./types";

const cardBase = css`
  position: absolute;
  width: 240px;
  border-radius: 16px;
  padding: 12px 12px 10px;

  color: rgba(255, 255, 255, 0.92);
  background:
    radial-gradient(120px 80px at 20% 10%, rgba(255,255,255,0.16), rgba(255,255,255,0) 70%),
    linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04)),
    rgba(0,0,0,0.28);

  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow:
    0 18px 35px rgba(0,0,0,0.38),
    inset 0 1px 0 rgba(255,255,255,0.14);

  user-select: none;
  touch-action: none; /* IMPORTANT: lets us drag on mobile */
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
`;

const title = css`
  font-weight: 900;
  letter-spacing: 0.2px;
`;

const sub = css`
  margin-top: 4px;
  font-size: 12px;
  opacity: 0.85;
`;

const desc = css`
  margin-top: 8px;
  font-size: 12px;
  opacity: 0.88;
`;

const chipRow = css`
  margin-top: 10px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

const chip = css`
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(0,0,0,0.22);
  border: 1px solid rgba(255,255,255,0.12);
  opacity: 0.9;
`;

export function GameCard({
  card,
  style,
  onClick,
  onDragStart,
  onDrag,
  onDragEnd,
}: {
  card: GameCardModel;
  style?: React.CSSProperties;

  onClick?: (card: GameCardModel) => void;

  // drag API:
  onDragStart?: (id: string) => void;
  onDrag?: (id: string, x: number, y: number) => void;
  onDragEnd?: (id: string) => void;
}) {
  const startRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    moved: boolean;
  } | null>(null);

  return (
    <div
      className={cardBase}
      style={style}
      onPointerDown={(e) => {
        // left click / touch only
        if (e.button !== 0 && e.pointerType === "mouse") return;

        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        onDragStart?.(card.id);

        const baseX = Number((style?.left as any) ?? 0);
        const baseY = Number((style?.top as any) ?? 0);

        startRef.current = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          baseX,
          baseY,
          moved: false,
        };

        console.log("[card] down", { id: card.id });
      }}
      onPointerMove={(e) => {
        const st = startRef.current;
        if (!st || st.pointerId !== e.pointerId) return;

        const dx = e.clientX - st.startX;
        const dy = e.clientY - st.startY;

        if (!st.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) st.moved = true;

        // new position
        const nx = st.baseX + dx;
        const ny = st.baseY + dy;

        onDrag?.(card.id, nx, ny);
      }}
      onPointerUp={(e) => {
        const st = startRef.current;
        if (!st || st.pointerId !== e.pointerId) return;

        (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        startRef.current = null;
        onDragEnd?.(card.id);

        console.log("[card] up", { id: card.id });

        // Treat as click only if we didn't drag
        if (!st.moved) onClick?.(card);
      }}
      onPointerCancel={(e) => {
        const st = startRef.current;
        if (!st || st.pointerId !== e.pointerId) return;

        startRef.current = null;
        onDragEnd?.(card.id);
      }}
    >
      <div className={title}>{card.title}</div>
      {card.subtitle && <div className={sub}>{card.subtitle}</div>}
      {card.description && <div className={desc}>{card.description}</div>}

      {/* tiny “gamey” chips (optional but helps vibe) */}
      <div className={chipRow}>
        <span className={chip}>Task</span>
        <span className={chip}>Inbox</span>
      </div>
    </div>
  );
}

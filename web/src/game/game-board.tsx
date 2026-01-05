// game-board.tsx
import { useMemo, useRef, useEffect, useState } from "react";
import { css } from "@linaria/core";

import { GameCard } from "./game-card";
import { GameDeck } from "./game-deck";
import { useGameState } from "./game-state";
import { ZONES, hitTestZone, type ZoneId } from "./zones";

const boardWrapper = css`
  margin-top: 12px;
  display: grid;
  gap: 12px;
`;

const table = css`
  position: relative;
  min-height: 820px;
  border-radius: 18px;
  overflow: hidden;

  /* “game table” vibe */
  background:
    radial-gradient(900px 600px at 30% 20%, rgba(130, 255, 200, 0.10), rgba(0, 0, 0, 0) 60%),
    radial-gradient(800px 500px at 70% 70%, rgba(120, 160, 255, 0.10), rgba(0, 0, 0, 0) 60%),
    linear-gradient(180deg, rgba(18, 18, 22, 1), rgba(10, 10, 14, 1));

  border: 1px solid rgba(255, 255, 255, 0.10);
  box-shadow: 0 30px 70px rgba(0, 0, 0, 0.45);
`;

const zoneBox = css`
  position: absolute;
  border-radius: 16px;
  padding: 12px;

  border: 1px dashed rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.04);

  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.10),
    0 10px 30px rgba(0, 0, 0, 0.25);
`;

const zoneActive = css`
  border: 1px solid rgba(180, 220, 255, 0.55);
  background: rgba(140, 190, 255, 0.10);
`;

const zoneTitle = css`
  font-weight: 900;
  color: rgba(255, 255, 255, 0.92);
`;

const zoneHint = css`
  margin-top: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.70);
`;

const hud = css`
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
`;

const hudPill = css`
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
`;

const hudButton = css`
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.92);
  cursor: pointer;
  font-weight: 700;

  &:hover {
    background: rgba(255, 255, 255, 0.10);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const cardsLayer = css`
  position: absolute;
  inset: 0;
`;

const canvasWrap = css`
  margin-top: 12px;
`;

export function GameBoard({ mode = "dom" }: { mode?: "dom" | "canvas" }) {
  const gs = useGameState();
  const cards = gs.st.cards;
  const remaining = gs.act.remainingUndrawn();

  const tableRef = useRef<HTMLDivElement | null>(null);

  // pointer drag state
  const dragRef = useRef<{
    id: string;
    offX: number;
    offY: number;
  } | null>(null);

  const [hoverZone, setHoverZone] = useState<ZoneId | null>(null);

  // compute zone rects in table coordinates
  const zoneRects = useMemo(() => {
    // ZONES typically have x,y,w,h already in table coords
    // If your ZONES are in percentages, convert here.
    return ZONES;
  }, []);

  function tablePoint(e: PointerEvent | React.PointerEvent) {
    const el = tableRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onPointerDown(e: React.PointerEvent, id: string) {
    // capture drag
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    const pt = tablePoint(e);
    const c = cards.find((x) => x.id === id);
    if (!c) return;

    dragRef.current = {
      id,
      offX: pt.x - c.x,
      offY: pt.y - c.y,
    };

    gs.act.bringToFront(id);
    console.log("[drag] down", { id });
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;

    const pt = tablePoint(e);
    const x = pt.x - drag.offX;
    const y = pt.y - drag.offY;

    gs.act.moveCard(drag.id, x, y);

    const zone = hitTestZone( pt.x, pt.y );
    setHoverZone(zone?.id ?? null);
  }

  function onPointerUp(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;

    const pt = tablePoint(e);
    const zone = hitTestZone( pt.x, pt.y );

    if (zone) {
      console.log("[snap] up", { id: drag.id, zone: zone.id });
      gs.act.snapToZone(drag.id, zone.id);
    } else {
      console.log("[snap] none", { id: drag.id });
    }

    dragRef.current = null;
    setHoverZone(null);
  }

  return (
    <div className={boardWrapper}>
      <div className={hud}>
        <div className={hudPill}>Cards on table: {cards.length}</div>
        <div className={hudPill}>Remaining in deck: {remaining}</div>

        <button className={hudButton} onClick={() => gs.act.openInboxDeck(3)}>
          Open Inbox Deck (+3)
        </button>

        <button className={hudButton} onClick={() => gs.act.clearBoard()}>
          Clear board
        </button>

        <div className={hudPill}>Renderer: {mode}</div>
      </div>

      <GameDeck
        title="Inbox Deck"
        hint="Open pack → spawn blank task cards, modifiers, etc."
        onOpen={() => gs.act.openInboxDeck(3)}
      />

      <div
        ref={tableRef}
        className={table}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Zones */}
        {zoneRects.map((z) => (
          <div
            key={z.id}
            className={`${zoneBox} ${hoverZone === z.id ? zoneActive : ""}`}
            style={{
              left: z.x,
              top: z.y,
              width: z.w,
              height: z.h,
            }}
          >
            <div className={zoneTitle}>{z.title}</div>
            {z.hint && <div className={zoneHint}>{z.hint}</div>}
          </div>
        ))}

        {/* Cards */}
        {mode === "canvas" ? (
          <div className={canvasWrap}>
            <CanvasLayer cards={cards} />
          </div>
        ) : (
          <div className={cardsLayer}>
            {cards
              .slice()
              .sort((a, b) => a.z - b.z)
              .map((c) => (
                <div
                  key={c.id}
                  style={{
                    position: "absolute",
                    left: c.x,
                    top: c.y,
                    transform: `rotate(${c.rot}deg)`,
                    zIndex: c.z,
                    touchAction: "none",
                  }}
                  onPointerDown={(e) => onPointerDown(e, c.id)}
                >
                  <GameCard
                    card={c}
                    onClick={() => console.log("[card click]", c.id)}
                  />
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CanvasLayer({ cards }: { cards: any[] }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    ctx.font = "14px ui-monospace, Menlo, monospace";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText("Canvas renderer placeholder", 12, 24);

    let y = 50;
    for (const c of cards) {
      ctx.fillText(`${c.subtitle ?? ""} ${c.title}`, 12, y);
      y += 18;
      if (y > height - 20) break;
    }
  }, [cards]);

  return (
    <canvas
      ref={ref}
      style={{
        width: "100%",
        height: 320,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(0,0,0,0.15)",
      }}
    />
  );
}

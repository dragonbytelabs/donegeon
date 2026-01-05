// inbox-game-view.tsx
import { useEffect } from "react";
import { useRevalidator } from "react-router";
import { GameBoard } from "../game/game-board";
import { useGameState } from "../game/game-state";
import type { Task } from "../lib/types";
import * as s from "../ui/styles";

export default function InboxGameView({ tasks }: { tasks: Task[] }) {
  const gs = useGameState();
  const revalidator = useRevalidator();

  useEffect(() => {
    gs.act.setTasks(tasks);
  }, [tasks, gs.act]);

  // Store revalidator in window so game state can trigger reload
  useEffect(() => {
    (window as any).__gameRevalidator = revalidator;
    return () => {
      delete (window as any).__gameRevalidator;
    };
  }, [revalidator]);

  return (
    <div>
      <div className={s.card} style={{ marginTop: 12 }}>
        <strong>Game view</strong>
        <div className={s.small} style={{ marginTop: 6 }}>
          Drag task cards to the "Complete Task" zone to finish them. Drag other cards to "♻️ Recycle" for coins.
        </div>
      </div>

      <GameBoard />
    </div>
  );
}

import type { Task } from "../lib/types";
import * as s from "../ui/styles";

export default function InboxGameView({ tasks }: { tasks: Task[] }) {
  return (
    <div className={s.card} style={{ marginTop: 12 }}>
      <strong>Game view (placeholder)</strong>
      <div className={s.small} style={{ marginTop: 6 }}>
        Next: we’ll replace these with draggable canvas cards.
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {tasks.map((t) => (
          <div key={t.id} className={s.card}>
            <div style={{ fontWeight: 700 }}>{t.name}</div>
            <div className={s.small}>#{t.id}</div>
            {t.description && (
              <div className={s.small} style={{ marginTop: 6 }}>
                {t.description}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

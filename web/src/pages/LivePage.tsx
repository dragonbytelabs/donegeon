import { useEffect } from "react";
import { useImmer } from "use-immer";
import { api } from "../lib/api";
import type { ModifierCard, Task, Zombie } from "../lib/types";
import * as s from "../ui/styles";

type State = {
  loading: boolean;
  error: string | null;
  tasks: Task[];
  zombies: Zombie[];

  openModsForTask: number | null;
  mods: ModifierCard[] | null;
};

export default function LivePage() {
  const [st, update] = useImmer<State>({
    loading: true,
    error: null,
    tasks: [],
    zombies: [],
    openModsForTask: null,
    mods: null,
  });

  async function refresh() {
    update((d) => {
      d.loading = true;
      d.error = null;
    });
    try {
      const [tasks, zombies] = await Promise.all([
        api.listLive(),
        api.zombies(),
      ]);
      update((d) => {
        d.tasks = tasks;
        d.zombies = zombies;
        d.loading = false;
      });
    } catch (e: any) {
      update((d) => {
        d.error = String(e?.message ?? e);
        d.loading = false;
      });
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div>
      <h2>Live</h2>

      <div className={s.card}>
        <div className={s.row}>
          <button
            className={s.button}
            onClick={async () => {
              await api.dayTick();
              await refresh();
            }}
          >
            Day Tick
          </button>

          <button className={s.button} onClick={refresh}>
            Refresh
          </button>

          <span className={s.small}>
            Zombies: {st.zombies.length} (blocking happens automatically based
            on count)
          </span>
        </div>

        {st.error && (
          <div style={{ color: "crimson", marginTop: 8 }}>{st.error}</div>
        )}
      </div>

      <div className={s.card}>
        <strong>Clear a zombie</strong>
        <div className={s.small} style={{ marginTop: 6 }}>
          Uses 1 or 2 villager slots (server chooses first available villager).
        </div>

        {st.zombies.length === 0 ? (
          <div style={{ marginTop: 10 }}>No zombies 🎉</div>
        ) : (
          <div style={{ marginTop: 10 }}>
            {st.zombies.map((z) => (
              <div key={z.id} className={s.row} style={{ padding: "6px 0" }}>
                <code>{z.id}</code>
                <span className={s.small}>
                  task #{z.task_id} • {z.reason}
                </span>
                <span style={{ flex: 1 }} />
                <button
                  className={s.button}
                  onClick={async () => {
                    await api.clearZombie(z.id, 1);
                    await refresh();
                  }}
                >
                  Clear (1)
                </button>
                <button
                  className={s.button}
                  onClick={async () => {
                    await api.clearZombie(z.id, 2);
                    await refresh();
                  }}
                >
                  Clear (2)
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {st.loading ? (
        <div>Loading…</div>
      ) : (
        <div className={s.card}>
          <strong>Live tasks</strong>
          <div style={{ marginTop: 10 }}>
            {st.tasks.map((t) => (
              <div
                key={t.id}
                style={{ borderBottom: "1px solid #f2f2f2", padding: "10px 0" }}
              >
                <div className={s.row}>
                  <code>#{t.id}</code>
                  <span style={{ fontWeight: 700 }}>{t.name}</span>
                  <span className={s.small}>{t.description}</span>
                  <span style={{ flex: 1 }} />

                  <button
                    className={s.button}
                    onClick={async () => {
                      const type = prompt(
                        "Modifier type:\n- deadline_pin\n- recurring_contract\n- importance_seal\n\n(Just paste one)",
                      ) as any;
                      if (!type) return;

                      if (type === "deadline_pin") {
                        const dt = prompt(
                          "deadline_at RFC3339 (e.g. 2026-01-03T05:00:00Z):",
                        );
                        if (!dt) return;
                        await api.addModifier({
                          task_id: t.id,
                          type,
                          deadline_at: dt,
                        });
                      } else if (type === "recurring_contract") {
                        const every = Number(
                          prompt("every_days (e.g. 1):") || "0",
                        );
                        if (!every) return;
                        await api.addModifier({
                          task_id: t.id,
                          type,
                          every_days: every,
                        });
                      } else if (type === "importance_seal") {
                        await api.addModifier({ task_id: t.id, type });
                      } else {
                        alert("Unknown type.");
                        return;
                      }

                      await refresh();
                    }}
                  >
                    + modifier
                  </button>

                  <button
                    className={s.button}
                    onClick={async () => {
                      const mods = await api.taskModifiers(t.id);
                      update((d) => {
                        d.openModsForTask = t.id;
                        d.mods = mods;
                      });
                    }}
                  >
                    View modifiers
                  </button>

                  <button
                    className={s.button}
                    onClick={async () => {
                      await api.completeTask(t.id);
                      await refresh();
                    }}
                  >
                    Complete
                  </button>
                </div>

                {st.openModsForTask === t.id && st.mods && (
                  <div className={s.card} style={{ marginTop: 10 }}>
                    <strong>Modifiers for #{t.id}</strong>
                    {st.mods.length === 0 ? (
                      <div className={s.small} style={{ marginTop: 6 }}>
                        none
                      </div>
                    ) : (
                      <div style={{ marginTop: 6 }}>
                        {st.mods.map((m) => (
                          <div
                            key={m.id}
                            className={s.row}
                            style={{ padding: "6px 0" }}
                          >
                            <code>{m.type}</code>
                            <span className={s.small}>
                              {m.status} • charges {m.charges}/{m.max_charges}
                            </span>
                            {m.deadline_at && (
                              <span className={s.small}>
                                deadline {m.deadline_at}
                              </span>
                            )}
                            {m.recurring_next_at && (
                              <span className={s.small}>
                                next {m.recurring_next_at}
                              </span>
                            )}
                            <span style={{ flex: 1 }} />
                            <button
                              className={s.button}
                              onClick={async () => {
                                await api.removeModifier(t.id, m.id);
                                await refresh();
                              }}
                            >
                              remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

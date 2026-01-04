import { useEffect } from "react";
import { useImmer } from "use-immer";
import { api } from "../lib/api";
import type { Task } from "../lib/types";
import { groupTasksByProject, listProjects } from "../lib/projects";
import * as s from "../ui/styles";

type State = {
  loading: boolean;
  error: string | null;
  tasks: Task[];

  name: string;
  description: string;

  projectName: string; // used to apply project tag on create
};

export default function InboxPage() {
  const [st, update] = useImmer<State>({
    loading: true,
    error: null,
    tasks: [],
    name: "",
    description: "",
    projectName: "",
  });

  async function refresh() {
    update((d) => {
      d.loading = true;
      d.error = null;
    });
    try {
      const tasks = await api.listInbox();
      update((d) => {
        d.tasks = tasks;
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
    console.log("inboxPage mounted");
    void refresh();
  }, []);

  const projects = listProjects(st.tasks);
  const grouped = groupTasksByProject(st.tasks);

  return (
    <div>
      <h2>Inbox</h2>

      <div className={s.card}>
        <div className={s.row}>
          <input
            className={s.input}
            placeholder="Task name"
            value={st.name}
            onChange={(e) => update((d) => void (d.name = e.target.value))}
          />
          <input
            className={s.input}
            placeholder="Description"
            value={st.description}
            onChange={(e) =>
              update((d) => void (d.description = e.target.value))
            }
          />
          <input
            className={s.input}
            placeholder="Project (optional) e.g. home"
            value={st.projectName}
            onChange={(e) =>
              update((d) => void (d.projectName = e.target.value))
            }
          />
          <button
            className={s.button}
            onClick={async () => {
              const name = st.name.trim();
              if (!name) return;

              const t = await api.createTask(name, st.description.trim());
              if (st.projectName.trim()) {
                await api.addTag(t.id, `project:${st.projectName.trim()}`);
              }
              update((d) => {
                d.name = "";
                d.description = "";
                d.projectName = "";
              });
              await refresh();
            }}
          >
            Create
          </button>

          <button className={s.button} onClick={refresh}>
            Refresh
          </button>
        </div>

        {projects.length > 0 && (
          <div className={s.small} style={{ marginTop: 8 }}>
            Projects discovered: {projects.join(", ")}
          </div>
        )}

        {st.error && (
          <div style={{ color: "crimson", marginTop: 8 }}>{st.error}</div>
        )}
      </div>

      {st.loading ? (
        <div>Loading…</div>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([project, tasks]) => (
            <div key={project} className={s.card}>
              <strong>{project}</strong>
              <div className={s.small} style={{ marginTop: 6 }}>
                {tasks.length} task(s)
              </div>

              <div style={{ marginTop: 10 }}>
                {tasks.map((t) => (
                  <InboxRow key={t.id} t={t} onChanged={refresh} />
                ))}
              </div>
            </div>
          ))
      )}
    </div>
  );
}

function InboxRow({
  t,
  onChanged,
}: {
  t: Task;
  onChanged: () => Promise<void>;
}) {
  console.log({ t });
  return (
    <div
      className={s.row}
      style={{ padding: "6px 0", borderBottom: "1px solid #f2f2f2" }}
    >
      <code>#{t.id}</code>
      <span style={{ fontWeight: 600 }}>{t.name}</span>
      <span className={s.small}>{t.description}</span>

      <span style={{ flex: 1 }} />

      <button
        className={s.button}
        onClick={async () => {
          const tag = prompt("Tag to add (e.g. project:home or urgent):");
          if (!tag) return;
          await api.addTag(t.id, tag);
          await onChanged();
        }}
      >
        + tag
      </button>

      <button
        className={s.button}
        onClick={async () => {
          await api.processTask(t.id);
          await onChanged();
        }}
      >
        → Live
      </button>

      <button
        className={s.button}
        onClick={async () => {
          await api.completeTask(t.id);
          await onChanged();
        }}
      >
        Complete
      </button>
    </div>
  );
}

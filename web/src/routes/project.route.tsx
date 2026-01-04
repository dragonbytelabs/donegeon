import { Link, useFetcher, useLoaderData } from "react-router";
import { api } from "../lib/api";
import * as s from "../ui/styles";

export async function projectLoader({ params }: { params: any }) {
  const name = String(params.name || "").trim();
  const tag = `project:${name}`;
  const tasks = await api.listInbox();
  const filtered = tasks.filter((t) => (t.tags ?? []).includes(tag));
  return { name, tag, tasks: filtered };
}

// reuse existing action (create/tag/process/complete)
export { inboxAction as projectAction } from "./inbox.route";

export default function ProjectRoute() {
  const { name, tasks } = useLoaderData<typeof projectLoader>(); 
  const fetcher = useFetcher();

  return (
    <div>
      <div className={s.row} style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Project: {name}</h2>
        <span style={{ flex: 1 }} />
        <Link className={s.button} to="/">
          ← Inbox
        </Link>
      </div>

      <div className={s.card}>
        {tasks.length === 0 ? (
          <div className={s.small}>No tasks tagged for this project yet.</div>
        ) : (
          tasks.map((t) => (
            <div key={t.id} className={s.row} style={{ padding: "6px 0", borderBottom: "1px solid #f2f2f2" }}>
              <code>#{t.id}</code>
              <span style={{ fontWeight: 600 }}>{t.name}</span>
              <span className={s.small}>{t.description}</span>
              <span style={{ flex: 1 }} />

              <button className={s.button} onClick={() => fetcher.submit({ intent: "process", id: String(t.id) }, { method: "post" })}>
                → Live
              </button>
              <button className={s.button} onClick={() => fetcher.submit({ intent: "complete", id: String(t.id) }, { method: "post" })}>
                Complete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

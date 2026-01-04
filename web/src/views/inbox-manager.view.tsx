import { Link, useFetcher } from "react-router";
import type { Task } from "../lib/types";
import * as s from "../ui/styles";
import { useRef } from "react";
import { groupTasksByProject, listProjects } from "../lib/projects";
import { useViewMode } from "../lib/view";
import type { inboxAction } from "../routes/inbox.route";
import InboxRow from "../ui/inbox-row";

export default function InboxManagerView({ tasks }: { tasks: Task[] }) {
    const createFetcher = useFetcher<typeof inboxAction>();
    const formRef = useRef<HTMLFormElement>(null);
    const projects = listProjects(tasks);
    const grouped = groupTasksByProject(tasks);

    const { mode, setMode } = useViewMode();
    return (
        <div>
            <div className={s.row} style={{ marginBottom: 10 }}>
                <h2 style={{ margin: 0 }}>Inbox</h2>
                <span style={{ flex: 1 }} />
                <button className={s.button} onClick={() => setMode(mode === "manager" ? "game" : "manager")}>
                    View: {mode === "manager" ? "Manager" : "Game"}
                </button>
            </div>
            <div className={s.card}>
                <createFetcher.Form method="post" className={s.row} ref={formRef}>
                    <input type="hidden" name="intent" value="create" />

                    <input className={s.input} name="name" placeholder="Task name" />
                    <input className={s.input} name="description" placeholder="Description" />
                    <input className={s.input} name="projectName" placeholder="Project (optional) e.g. home" />

                    <button className={s.button} type="submit" disabled={createFetcher.state !== "idle"}>
                        {createFetcher.state === "submitting" ? "Creating..." : "Create"}
                    </button>
                </createFetcher.Form>

                {projects.length > 0 && (
                    <div className={s.small} style={{ marginTop: 8 }}>
                        Projects:{" "}
                        {projects.map((p, i) => (
                            <span key={p}>
                                <Link to={`/project/${encodeURIComponent(p)}`}>{p}</Link>
                                {i < projects.length - 1 ? ", " : ""}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {Object.entries(grouped)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([project, ts]) => (
                    <div key={project} className={s.card}>
                        <strong>{project}</strong>
                        <div className={s.small} style={{ marginTop: 6 }}>
                            {ts.length} task(s)
                        </div>

                        <div style={{ marginTop: 10 }}>
                            {ts.map((t) => (
                                <InboxRow key={t.id} t={t} />
                            ))}
                        </div>
                    </div>
                ))}
        </div>
    )
}

import { useFetcher } from "react-router";
import type { inboxAction } from "../routes/inbox.route";
import type { Task } from "../lib/types";
import * as s from "../ui/styles";

export default function InboxRow({ t }: { t: Task; }) {
    const fetcher = useFetcher<typeof inboxAction>();

    return (
        <div className={s.row} style={{ padding: "6px 0", borderBottom: "1px solid #f2f2f2" }}>
            <code>#{t.id}</code>
            <span style={{ fontWeight: 600 }}>{t.name}</span>
            <span className={s.small}>{t.description}</span>
            <span style={{ flex: 1 }} />

            <button
                className={s.button}
                onClick={() => {
                    const tag = prompt("Tag to add (e.g. project:home or urgent):");
                    if (!tag) return;
                    fetcher.submit({ intent: "tag", id: String(t.id), tag }, { method: "post" });
                }}
            >
                + tag
            </button>

            <button className={s.button} onClick={() => fetcher.submit({ intent: "process", id: String(t.id) }, { method: "post" })}>
                → Live
            </button>

            <button className={s.button} onClick={() => fetcher.submit({ intent: "complete", id: String(t.id) }, { method: "post" })}>
                Complete
            </button>
        </div>
    );
}
import { useLoaderData, useFetcher } from "react-router";
import { api } from "../lib/api";
import { useEffect, useRef } from "react";
import { useViewMode } from "../lib/view";
import InboxGameView from "../views/inbox-game.view";
import InboxManagerView from "../views/inbox-manager.view";
import { GameStateProvider } from "../game/game-state";



export async function inboxLoader() {
    const tasks = await api.listInbox();
    return { tasks };
}

export async function inboxAction({ request }: { request: Request }) {
    const fd = await request.formData();
    const intent = String(fd.get("intent") || "");

    if (intent === "create") {
        const name = String(fd.get("name") || "").trim();
        const description = String(fd.get("description") || "").trim();
        const projectName = String(fd.get("projectName") || "").trim();

        if (!name) throw new Response("name is required", { status: 400 });

        const t = await api.createTask(name, description);
        if (projectName) {
            await api.addTag(t.id, `project:${projectName}`);
        }
        return { ok: true };
    }

    if (intent === "tag") {
        const id = Number(fd.get("id"));
        const tag = String(fd.get("tag") || "").trim();
        if (!id || !tag) throw new Response("id + tag required", { status: 400 });
        await api.addTag(id, tag);
        return { ok: true };
    }

    if (intent === "process") {
        const id = Number(fd.get("id"));
        if (!id) throw new Response("id required", { status: 400 });
        await api.moveTaskToLive(id);
        return { ok: true };
    }

    if (intent === "complete") {
        const id = Number(fd.get("id"));
        if (!id) throw new Response("id required", { status: 400 });
        await api.completeTask(id);
        return { ok: true };
    }

    if (intent === "reorder") {
        const sourceId = Number(fd.get("sourceId"));
        const targetId = Number(fd.get("targetId"));
        if (!sourceId || !targetId) throw new Response("sourceId + targetId required", { status: 400 });
        await api.reorderTask(sourceId, targetId);
        return { ok: true };
    }

    throw new Response("unknown intent", { status: 400 });
}

export default function InboxRoute() {
  const { tasks } = useLoaderData<typeof inboxLoader>();
  const createFetcher = useFetcher<typeof inboxAction>();
  const formRef = useRef<HTMLFormElement>(null);

  const { mode } = useViewMode();

  useEffect(() => {
    if (createFetcher.state === "idle" && createFetcher.data?.ok) {
      formRef.current?.reset();
    }
  }, [createFetcher.state, createFetcher.data]);

  return mode === "game" ? (
<GameStateProvider initialTasks={tasks}>
  <InboxGameView tasks={tasks} />
</GameStateProvider>
  ) : (
    <InboxManagerView tasks={tasks} />
  );
}

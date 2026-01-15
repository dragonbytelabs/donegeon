import { For, createEffect, createSignal } from "solid-js";
import { A } from "@solidjs/router";
import { Button } from "@kobalte/core/button";
import { apiGet } from "../lib/api";
import type { TaskDto } from "@donegeon/app/api";

export default function TasksRoute() {
  const [inbox, setInbox] = createSignal<TaskDto[]>([]);
  const [live, setLive] = createSignal<TaskDto[]>([]);
  const [completed, setCompleted] = createSignal<TaskDto[]>([]);

  createEffect(() => {
    void (async () => {
      setInbox(await apiGet<TaskDto[]>("/api/tasks/inbox"));
      setLive(await apiGet<TaskDto[]>("/api/tasks/live"));
      setCompleted(await apiGet<TaskDto[]>("/api/tasks/completed"));
    })();
  });

  return (
    <main class="min-h-screen">
      <div class="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-xs font-semibold uppercase tracking-widest text-slate-400">Donegeon</div>
            <h1 class="mt-2 text-3xl font-black tracking-tight">Tasks</h1>
          </div>
          <div class="flex items-center gap-2">
            <A href="/board">
              <Button class="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                Board
              </Button>
            </A>
            <A href="/">
              <Button class="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                Dashboard
              </Button>
            </A>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
            <div class="text-sm font-semibold text-slate-200">Inbox</div>
            <div class="mt-3 flex flex-col gap-2">
              <For each={inbox()}>{(t) => <div class="rounded-md bg-slate-950/40 p-3 text-sm text-slate-200">#{t.id} {t.name}</div>}</For>
            </div>
          </div>
          <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
            <div class="text-sm font-semibold text-slate-200">Live</div>
            <div class="mt-3 flex flex-col gap-2">
              <For each={live()}>{(t) => <div class="rounded-md bg-slate-950/40 p-3 text-sm text-slate-200">#{t.id} {t.name}</div>}</For>
            </div>
          </div>
          <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
            <div class="text-sm font-semibold text-slate-200">Completed</div>
            <div class="mt-3 flex flex-col gap-2">
              <For each={completed()}>{(t) => <div class="rounded-md bg-slate-950/40 p-3 text-sm text-slate-200">#{t.id} {t.name}</div>}</For>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}


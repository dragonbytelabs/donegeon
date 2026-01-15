import { createEffect, createSignal, For, Show } from "solid-js";
import "./app.css";
import { Button } from "@kobalte/core/button";
import { createGameStore } from "./state/gameStore";
import { A } from "@solidjs/router";

export default function App() {
  const { state, actions } = createGameStore();
  const [taskName, setTaskName] = createSignal("");
  const [taskDescription, setTaskDescription] = createSignal("");
  const [moveToLive, setMoveToLive] = createSignal(true);

  createEffect(() => {
    void actions.refreshAll();
  });

  return (
    <main class="min-h-screen">
      <div class="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="text-xs font-semibold uppercase tracking-widest text-slate-400">Donegeon</div>
            <h1 class="mt-2 text-3xl font-black tracking-tight">Donegeon Dashboard</h1>
            <p class="mt-2 text-slate-300">
              Frontend is a view. Backend owns rules. This page drives the engine through the API.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <A href="/board">
              <Button class="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                Board
              </Button>
            </A>
            <A href="/tasks">
              <Button class="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                Tasks
              </Button>
            </A>
            <Button
              class="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              onClick={() => void actions.refreshAll()}
            >
              Refresh
            </Button>
            <Button
              class="rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
              onClick={() => void actions.dayTick()}
            >
              Day Tick
            </Button>
            <Button
              class="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              onClick={() => void actions.openFirstDayDeck()}
            >
              Open First Day Deck
            </Button>
          </div>
        </div>

        <Show when={state.error}>
          <div class="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-200">
            {state.error}
          </div>
        </Show>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
            <div class="flex items-center justify-between">
              <div class="text-sm font-semibold text-slate-200">Backend</div>
              <div class="text-xs text-slate-400">{state.loading ? "loading…" : "ready"}</div>
            </div>
            <div class="mt-2 text-sm text-slate-300">
              {state.version ? (
                <span>
                  {state.version.name} <span class="text-slate-500">v</span>
                  {state.version.version}
                </span>
              ) : (
                <span class="text-slate-500">unknown</span>
              )}
            </div>

            <div class="mt-6 text-sm font-semibold text-slate-200">Today</div>
            <div class="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-300">
              <div class="rounded-md bg-slate-950/40 p-2">
                <div class="text-xs text-slate-500">Danger</div>
                <div>{state.today?.danger_level ?? "-"}</div>
              </div>
              <div class="rounded-md bg-slate-950/40 p-2">
                <div class="text-xs text-slate-500">Zombies</div>
                <div>{state.today?.zombies_active ?? 0}</div>
              </div>
              <div class="rounded-md bg-slate-950/40 p-2">
                <div class="text-xs text-slate-500">Live Tasks</div>
                <div>{state.today?.tasks_live ?? 0}</div>
              </div>
              <div class="rounded-md bg-slate-950/40 p-2">
                <div class="text-xs text-slate-500">Completed Today</div>
                <div>{state.today?.tasks_completed_today ?? 0}</div>
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
            <div class="text-sm font-semibold text-slate-200">Loot</div>
            <div class="mt-2 grid grid-cols-3 gap-2 text-sm text-slate-300">
              <div class="rounded-md bg-slate-950/40 p-2">
                <div class="text-xs text-slate-500">Coin</div>
                <div>{state.loot?.coin ?? 0}</div>
              </div>
              <div class="rounded-md bg-slate-950/40 p-2">
                <div class="text-xs text-slate-500">Paper</div>
                <div>{state.loot?.paper ?? 0}</div>
              </div>
              <div class="rounded-md bg-slate-950/40 p-2">
                <div class="text-xs text-slate-500">Ink</div>
                <div>{state.loot?.ink ?? 0}</div>
              </div>
              <div class="rounded-md bg-slate-950/40 p-2">
                <div class="text-xs text-slate-500">Gear</div>
                <div>{state.loot?.gear ?? 0}</div>
              </div>
              <div class="rounded-md bg-slate-950/40 p-2">
                <div class="text-xs text-slate-500">Parts</div>
                <div>{state.loot?.parts ?? 0}</div>
              </div>
              <div class="rounded-md bg-slate-950/40 p-2">
                <div class="text-xs text-slate-500">Blueprint</div>
                <div>{state.loot?.blueprint_shard ?? 0}</div>
              </div>
            </div>

            <Show when={state.lastDeckOpen}>
              <div class="mt-6 text-sm font-semibold text-slate-200">Last deck open</div>
              <div class="mt-2 rounded-md bg-slate-950/40 p-3 text-xs text-slate-300">
                {JSON.stringify(state.lastDeckOpen, null, 2)}
              </div>
            </Show>

            <Show when={state.lastDeckOpenTransition}>
              <div class="mt-6 text-sm font-semibold text-slate-200">Deck open transition (v0.1)</div>
              <div class="mt-2 rounded-md bg-slate-950/40 p-3 text-xs text-slate-300">
                {JSON.stringify(state.lastDeckOpenTransition, null, 2)}
              </div>
            </Show>
          </div>

          <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
            <div class="text-sm font-semibold text-slate-200">Create Task</div>
            <div class="mt-3 flex flex-col gap-3">
              <input
                class="w-full rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600"
                placeholder="Task name"
                value={taskName()}
                onInput={(e) => setTaskName(e.currentTarget.value)}
              />
              <input
                class="w-full rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600"
                placeholder="Description (optional)"
                value={taskDescription()}
                onInput={(e) => setTaskDescription(e.currentTarget.value)}
              />
              <label class="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={moveToLive()}
                  onInput={(e) => setMoveToLive(e.currentTarget.checked)}
                />
                Move to Live
              </label>
              <Button
                class="rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
                onClick={() => {
                  const name = taskName().trim();
                  if (!name) return;
                  void actions.createTask(name, taskDescription().trim(), moveToLive());
                  setTaskName("");
                  setTaskDescription("");
                }}
              >
                Create
              </Button>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
            <div class="flex items-center justify-between">
              <div class="text-sm font-semibold text-slate-200">Live Tasks</div>
              <div class="text-xs text-slate-400">{state.tasksLive.length}</div>
            </div>
            <div class="mt-3 flex flex-col gap-2">
              <For each={state.tasksLive}>
                {(t) => (
                  <div class="rounded-md border border-slate-800 bg-slate-950/30 p-3">
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <div class="text-sm font-semibold text-slate-200">
                          #{t.id} {t.name}
                        </div>
                        <div class="mt-1 text-xs text-slate-400">{t.description}</div>
                        <div class="mt-2 text-xs text-slate-500">
                          tags: {t.tags.join(", ") || "—"} · priority: {t.priority} · progress:{" "}
                          {Math.round(t.work_progress * 100)}%
                        </div>
                      </div>
                      <div class="flex flex-col gap-2">
                        <Button
                          class="rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                          onClick={() => void actions.addModifier(t.id, "importance_seal")}
                        >
                          + Importance Seal
                        </Button>
                        <Button
                          class="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
                          onClick={() => void actions.assignAndWork(t.id, "v1", 1)}
                        >
                          Work 1h (v1)
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </For>
              <Show when={state.tasksLive.length === 0}>
                <div class="text-sm text-slate-500">No live tasks.</div>
              </Show>
            </div>
          </div>

          <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
            <div class="flex items-center justify-between">
              <div class="text-sm font-semibold text-slate-200">Zombies</div>
              <div class="text-xs text-slate-400">{state.zombies.length}</div>
            </div>
            <div class="mt-3 flex flex-col gap-2">
              <For each={state.zombies}>
                {(z) => (
                  <div class="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-950/30 p-3">
                    <div class="text-sm text-slate-200">
                      <span class="font-semibold">{z.id}</span>
                      <span class="text-slate-500"> · </span>
                      task #{z.task_id}
                      <span class="text-slate-500"> · </span>
                      {z.reason}
                    </div>
                    <Button
                      class="rounded-md bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600"
                      onClick={() => void actions.clearZombie(z.id, 1)}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </For>
              <Show when={state.zombies.length === 0}>
                <div class="text-sm text-slate-500">No zombies right now.</div>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

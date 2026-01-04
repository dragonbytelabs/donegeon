import { useEffect } from "react";
import { useImmer } from "use-immer";
import { api } from "../lib/api";
import type { Villager, World, Zombie } from "../lib/types";
import * as s from "../ui/styles";

type State = {
  loading: boolean;
  error: string | null;
  world: World | null;
  villagers: Villager[];
  zombies: Zombie[];
};

export default function WorldPage() {
  const [st, update] = useImmer<State>({
    loading: true,
    error: null,
    world: null,
    villagers: [],
    zombies: [],
  });

  async function refresh() {
    update((d) => {
      d.loading = true;
      d.error = null;
    });
    try {
      const [world, villagers, zombies] = await Promise.all([
        api.world(),
        api.villagers(),
        api.zombies(),
      ]);
      update((d) => {
        d.world = world;
        d.villagers = villagers;
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
      <h2>World</h2>

      <div className={s.card}>
        <div className={s.row}>
          <button className={s.button} onClick={refresh}>
            Refresh
          </button>
          <button
            className={s.button}
            onClick={async () => {
              await api.dayTick();
              await refresh();
            }}
          >
            Day Tick
          </button>
        </div>

        {st.error && (
          <div style={{ color: "crimson", marginTop: 8 }}>{st.error}</div>
        )}
      </div>

      {st.loading ? (
        <div>Loading…</div>
      ) : (
        <>
          <div className={s.card}>
            <strong>World</strong>
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(st.world, null, 2)}
            </pre>
          </div>

          <div className={s.card}>
            <strong>Villagers</strong>
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(st.villagers, null, 2)}
            </pre>
          </div>

          <div className={s.card}>
            <strong>Zombies</strong>
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(st.zombies, null, 2)}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}

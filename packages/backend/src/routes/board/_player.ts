import type { Context, MiddlewareHandler } from "hono";

export type PlayerEnv = {
  Variables: {
    playerId: string;
  };
};

export const requirePlayerId: MiddlewareHandler<PlayerEnv> = async (c, next) => {
  const pid = c.req.header("X-Donegeon-Player");
  if (!pid) return c.json({ error: "missing X-Donegeon-Player header" }, 400);
  c.set("playerId", pid);
  await next();
};

export function playerIdFromContext(c: Context<PlayerEnv>): string {
  return c.get("playerId");
}


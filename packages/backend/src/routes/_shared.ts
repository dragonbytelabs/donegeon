import { z } from 'zod';
import type { Context } from 'hono';

export type JsonErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500 | 501;

export function jsonError(c: Context, status: JsonErrorStatus, message: string) {
  return c.json({ error: message }, status);
}

export const zTaskId = z.number().int().positive();
export const zProjectId = z.number().int().positive();
export const zVillagerId = z.string().min(1);
export const zModifierId = z.string().min(1);


import { drizzle } from "drizzle-orm/d1";
import type { Context } from "hono";
import type { Services } from "../services";

export type Env = {
  Bindings: { DB: D1Database };
  Variables: { services: Services };
};

export const createDb = (d1: D1Database) => drizzle(d1);
export type DB = ReturnType<typeof createDb>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lê o `:publicId` da rota como UUID válido, ou `null`. */
export const paramPublicId = (c: Context) => {
  const value = c.req.param("publicId");
  return value && UUID_RE.test(value) ? value : null;
};

export const or404 = (c: Context, item: unknown) =>
  item ? c.json(item) : c.json({ error: "Not Found" }, 404);

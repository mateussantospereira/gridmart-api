import { drizzle } from "drizzle-orm/d1";
import type { Context } from "hono";
import type { Services } from "../services";

export type Env = {
  Bindings: { DB: D1Database; ADMIN_TOKEN?: string };
  Variables: { services: Services };
};

export const createDb = (d1: D1Database) => drizzle(d1);
export type DB = ReturnType<typeof createDb>;

/** Lê o `:id` da rota como inteiro válido, ou `null`. */
export const paramId = (c: Context): number | null => {
  const value = Number(c.req.param("id"));
  return Number.isInteger(value) && value > 0 ? value : null;
};

export const or404 = (c: Context, item: unknown) =>
  item ? c.json(item) : c.json({ error: "Not Found" }, 404);

import { drizzle } from "drizzle-orm/d1";
import type { Context } from "hono";
import type { Services } from "../core/container";

export type Env = {
  Bindings: { DB: D1Database };
  Variables: { services: Services };
};

export const createDb = (d1: D1Database) => drizzle(d1);
export type DB = ReturnType<typeof createDb>;

export const paramId = (c: Context) => Number(c.req.param("id"));

export const or404 = (c: Context, item: unknown) =>
  item ? c.json(item) : c.json({ error: "Not Found" }, 404);

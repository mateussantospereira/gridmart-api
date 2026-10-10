import { HTTPException } from "hono/http-exception";
import type { ErrorHandler } from "hono";

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }

  console.error(`[${c.req.method}] ${c.req.path}:`, err);
  const status = err.message?.includes("UNIQUE") ? 409 : 500;
  return c.json({ error: err.message }, status);
};

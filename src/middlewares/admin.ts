import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { timingSafeEqual } from "../utils/crypto";
import type { Env } from "../utils/api";

/**
 * Protege as rotas `/admin/*` com um token secreto (header `x-admin-token`).
 * Falha fechado: se `ADMIN_TOKEN` não estiver configurado, nega tudo.
 */
export const adminAuth: MiddlewareHandler<Env> = async (c, next) => {
  const expected = c.env.ADMIN_TOKEN;
  const provided = c.req.header("x-admin-token");

  if (!expected || !provided || !timingSafeEqual(provided, expected)) {
    throw new HTTPException(401, { message: "Não autorizado" });
  }

  await next();
};

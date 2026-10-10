import { Hono } from "hono";
import type { Context } from "hono";
import { createDb, type DB, type Env } from "./utils/api";
import { createServices } from "./services";
import { errorHandler } from "./middlewares/errorHandler";
import { productRoutes } from "./routes/products";
import { accessRoutes } from "./routes/access";
import { saleRoutes } from "./routes/sales";

/**
 * Monta o app. O `makeDb` permite trocar o banco nos testes
 * (SQLite em memória) sem depender do Cloudflare.
 */
export function createApp(makeDb: (c: Context<Env>) => DB = (c) => createDb(c.env.DB)) {
  const app = new Hono<Env>();

  app.use(async (c, next) => {
    c.set("services", createServices(makeDb(c)));
    await next();
  });
  app.onError(errorHandler);

  app.route("/products", productRoutes);
  app.route("/access", accessRoutes);
  app.route("/sales", saleRoutes);

  return app;
}

export default createApp();
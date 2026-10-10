import { Hono } from "hono";
import type { Context } from "hono";
import { errorHandler } from "./middlewares/errorHandler";
import { withServices } from "./core/container";
import { productRoutes } from "./modules/products/products.routes";
import { accessRoutes } from "./modules/access/access.routes";
import { saleRoutes } from "./modules/sales/sales.routes";
import { deviceRoutes } from "./modules/devices/devices.routes";
import { pixWebhookRoutes } from "./modules/webhooks/pix.routes";
import type { DB, Env } from "./utils/api";

export interface AppOptions {
  /** Permite injetar outro banco (ex.: SQLite em memória nos testes). */
  makeDb?: (c: Context<Env>) => DB;
}

export function createApp({ makeDb }: AppOptions = {}) {
  const app = new Hono<Env>();

  app.use(withServices(makeDb));
  app.onError(errorHandler);

  app.route("/products", productRoutes);
  app.route("/access", accessRoutes);
  app.route("/sales", saleRoutes);
  app.route("/devices", deviceRoutes);
  app.route("/webhooks", pixWebhookRoutes);

  return app;
}

export default createApp();

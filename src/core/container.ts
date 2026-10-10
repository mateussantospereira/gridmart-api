import type { Context, MiddlewareHandler } from "hono";
import { createDb, type DB, type Env } from "../utils/api";
import { D1DoorGateway } from "../adapters/door";
import { FakePixGateway } from "../adapters/pix";
import { AccessService } from "./access/AccessService";
import { SalesService } from "./sales/SalesService";
import { ProductService } from "./products/ProductService";
import { DeviceService } from "./devices/DeviceService";

/** Monta os serviços de domínio a partir de uma conexão de banco. */
export const buildServices = (db: DB) => {
  const door = new D1DoorGateway(db);
  const pix = new FakePixGateway();

  return {
    access: new AccessService(db, door),
    sales: new SalesService(db, pix),
    products: new ProductService(db),
    devices: new DeviceService(db),
    door,
    pix,
  };
};

export type Services = ReturnType<typeof buildServices>;

/**
 * Injeta os serviços no contexto da requisição.
 * O `makeDb` permite trocar o banco nos testes (SQLite em memória).
 */
export const withServices = (
  makeDb: (c: Context<Env>) => DB = (c) => createDb(c.env.DB),
): MiddlewareHandler<Env> =>
  async (c, next) => {
    c.set("services", buildServices(makeDb(c)));
    await next();
  };

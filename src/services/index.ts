import type { DB } from "../utils/api";
import { AccessService } from "./access";
import { SalesService } from "./sales";
import { ProductService } from "./products";

export type Services = {
  access: AccessService;
  sales: SalesService;
  products: ProductService;
};

export const createServices = (db: DB): Services => ({
  access: new AccessService(db),
  sales: new SalesService(db),
  products: new ProductService(db),
});
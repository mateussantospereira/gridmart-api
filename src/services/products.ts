import { eq } from "drizzle-orm";
import { products } from "../db/schema";
import type { DB } from "../utils/api";

export type ProductInput = {
  barcode: string;
  name: string;
  priceInCents: number;
};

export class ProductService {
  constructor(private db: DB) {}

  list() {
    return this.db.select().from(products).all();
  }

  byId(id: number | null) {
    if (!id) return undefined;
    return this.db.select().from(products).where(eq(products.id, id)).get();
  }

  byBarcode(barcode: string) {
    return this.db.select().from(products).where(eq(products.barcode, barcode)).get();
  }

  create(data: ProductInput) {
    return this.db.insert(products).values(data).returning().get();
  }

  update(id: number | null, data: Partial<ProductInput>) {
    if (!id) return undefined;
    return this.db.update(products).set(data).where(eq(products.id, id)).returning().get();
  }

  remove(id: number | null) {
    if (!id) return undefined;
    return this.db.delete(products).where(eq(products.id, id)).returning().get();
  }
}

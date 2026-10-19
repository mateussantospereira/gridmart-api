import { eq } from "drizzle-orm";
import { products } from "../db/schema";
import type { DB } from "../utils/api";

export type ProductInput = typeof products.$inferInsert;

export class ProductService {
  constructor(private db: DB) { }

  list() {
    return this.db.select().from(products).all();
  }

  byId(id: number) {
    return this.db.select().from(products).where(eq(products.id, id)).get();
  }

  byBarcode(barcode: string) {
    return this.db.select().from(products).where(eq(products.barcode, barcode)).get();
  }

  create(data: ProductInput) {
    return this.db.insert(products).values(data).returning().get();
  }

  update(id: number, data: Partial<ProductInput>) {
    return this.db.update(products).set(data).where(eq(products.id, id)).returning().get();
  }

  remove(id: number) {
    return this.db.delete(products).where(eq(products.id, id)).returning().get();
  }
}

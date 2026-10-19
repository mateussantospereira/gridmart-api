import { eq } from "drizzle-orm";
import { products } from "../db/schema";
import type { DB } from "../utils/api";

/** Colunas expostas pela API: `publicId` no lugar do `id` interno. */
export const productPublicColumns = {
  id: products.publicId,
  barcode: products.barcode,
  name: products.name,
  priceInCents: products.priceInCents,
};

export type ProductInput = {
  barcode: string;
  name: string;
  priceInCents: number;
};

export class ProductService {
  constructor(private db: DB) {}

  list() {
    return this.db.select(productPublicColumns).from(products).all();
  }

  byPublicId(publicId: string | null) {
    if (!publicId) return undefined;
    return this.db.select(productPublicColumns).from(products).where(eq(products.publicId, publicId)).get();
  }

  byBarcode(barcode: string) {
    return this.db.select(productPublicColumns).from(products).where(eq(products.barcode, barcode)).get();
  }

  create(data: ProductInput) {
    return this.db.insert(products).values(data).returning(productPublicColumns).get();
  }

  update(publicId: string | null, data: Partial<ProductInput>) {
    if (!publicId) return undefined;
    return this.db
      .update(products)
      .set(data)
      .where(eq(products.publicId, publicId))
      .returning(productPublicColumns)
      .get();
  }

  remove(publicId: string | null) {
    if (!publicId) return undefined;
    return this.db.delete(products).where(eq(products.publicId, publicId)).returning(productPublicColumns).get();
  }
}

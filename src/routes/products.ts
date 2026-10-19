import { Hono } from "hono";
import { or404, paramPublicId, type Env } from "../utils/api";

// Catálogo público, somente leitura (usado pelo totem).
// Escrita de produtos acontece em /admin/products.
export const productRoutes = new Hono<Env>();

productRoutes.get("/", async (c) => c.json(await c.get("services").products.list()));

productRoutes.get("/:publicId", async (c) =>
  or404(c, await c.get("services").products.byPublicId(paramPublicId(c))),
);

productRoutes.get("/barcode/:barcode", async (c) =>
  or404(c, await c.get("services").products.byBarcode(c.req.param("barcode"))),
);

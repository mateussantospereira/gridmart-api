import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createInsertSchema } from "drizzle-zod";
import { products } from "../db/schema";
import { or404, paramId, type Env } from "../utils/api";

export const productRoutes = new Hono<Env>();
const schema = createInsertSchema(products).omit({ id: true });

productRoutes.get("/", async (c) => c.json(await c.get("services").products.list()));

productRoutes.get("/:id", async (c) => or404(c, await c.get("services").products.byId(paramId(c))));

productRoutes.get("/barcode/:barcode", async (c) =>
  or404(c, await c.get("services").products.byBarcode(c.req.param("barcode"))),
);

productRoutes.post("/", zValidator("json", schema), async (c) =>
  c.json(await c.get("services").products.create(c.req.valid("json")), 201),
);

productRoutes.put("/:id", zValidator("json", schema.partial()), async (c) =>
  or404(c, await c.get("services").products.update(paramId(c), c.req.valid("json"))),
);

productRoutes.delete("/:id", async (c) => or404(c, await c.get("services").products.remove(paramId(c))));
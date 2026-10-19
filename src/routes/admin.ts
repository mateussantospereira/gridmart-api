import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { products } from "../db/schema";
import { adminAuth } from "../middlewares/admin";
import { or404, paramPublicId, type Env } from "../utils/api";

export const adminRoutes = new Hono<Env>();

// Tudo em /admin exige o token secreto.
adminRoutes.use("*", adminAuth);

const productSchema = createInsertSchema(products).omit({ id: true, publicId: true });

// ── Produtos ─────────────────────────────────────────────────────────────

adminRoutes.get("/products", async (c) => c.json(await c.get("services").products.list()));

adminRoutes.post("/products", zValidator("json", productSchema), async (c) =>
  c.json(await c.get("services").products.create(c.req.valid("json")), 201),
);

adminRoutes.put("/products/:publicId", zValidator("json", productSchema.partial()), async (c) =>
  or404(c, await c.get("services").products.update(paramPublicId(c), c.req.valid("json"))),
);

adminRoutes.delete("/products/:publicId", async (c) =>
  or404(c, await c.get("services").products.remove(paramPublicId(c))),
);

// ── Vendas ───────────────────────────────────────────────────────────────

adminRoutes.get("/sales", async (c) =>
  c.json(await c.get("services").sales.list(c.req.query("status"))),
);

// Confirmação de pagamento no lugar do webhook do Pix.
adminRoutes.post("/sales/:publicId/pay", async (c) =>
  c.json(await c.get("services").sales.pay(paramPublicId(c))),
);

// ── Visitas ──────────────────────────────────────────────────────────────

adminRoutes.get("/visits", async (c) =>
  c.json(await c.get("services").access.listVisits(c.req.query("status"))),
);

adminRoutes.post("/visits/:publicId/close", async (c) =>
  c.json(await c.get("services").access.closeVisit(paramPublicId(c))),
);

// ── Usuários ─────────────────────────────────────────────────────────────

adminRoutes.get("/users", async (c) => c.json(await c.get("services").access.listUsers()));

adminRoutes.post(
  "/users/:publicId/block",
  zValidator("json", z.object({ isBlocked: z.boolean() })),
  async (c) =>
    c.json(await c.get("services").access.setBlocked(paramPublicId(c), c.req.valid("json").isBlocked)),
);

// ── Auditoria ────────────────────────────────────────────────────────────

adminRoutes.get("/access-logs", async (c) => {
  const limit = Number(c.req.query("limit") ?? 100);
  return c.json(await c.get("services").access.listAccessLogs(Number.isFinite(limit) ? limit : 100));
});

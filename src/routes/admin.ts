import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { products } from "../db/schema";
import { adminAuth } from "../middlewares/admin";
import { or404, paramId, type Env } from "../utils/api";

export const adminRoutes = new Hono<Env>();

// Tudo em /admin exige o token secreto.
adminRoutes.use("*", adminAuth);

const productSchema = createInsertSchema(products).omit({ id: true });

// ── Produtos (listar é público; aqui só a escrita) ───────────────────────

adminRoutes.post("/products", zValidator("json", productSchema), async (c) =>
  c.json(await c.get("services").products.create(c.req.valid("json")), 201),
);

adminRoutes.put("/products/:id", zValidator("json", productSchema.partial()), async (c) =>
  or404(c, await c.get("services").products.update(paramId(c), c.req.valid("json"))),
);

adminRoutes.delete("/products/:id", async (c) =>
  or404(c, await c.get("services").products.remove(paramId(c))),
);

// ── Vendas ───────────────────────────────────────────────────────────────

adminRoutes.get("/sales", async (c) =>
  c.json(await c.get("services").sales.list(c.req.query("status"))),
);

// Muda o estado da venda. Por enquanto só PENDING -> PAID
// (a confirmação manual no lugar do webhook do Pix).
adminRoutes.put(
  "/sales/:id",
  zValidator("json", z.object({ status: z.literal("PAID") })),
  async (c) => c.json(await c.get("services").sales.pay(paramId(c))),
);

// ── Visitas ──────────────────────────────────────────────────────────────

adminRoutes.get("/visits", async (c) =>
  c.json(await c.get("services").access.listVisits(c.req.query("status"))),
);

// Fecha a visita (ex.: o cliente saiu pela botoeira).
adminRoutes.put(
  "/visits/:id",
  zValidator("json", z.object({ status: z.literal("CLOSED") })),
  async (c) => c.json(await c.get("services").access.closeVisit(paramId(c))),
);

// ── Usuários ─────────────────────────────────────────────────────────────

adminRoutes.get("/users", async (c) => c.json(await c.get("services").access.listUsers()));

// Bloqueia/desbloqueia o cliente.
adminRoutes.put(
  "/users/:id",
  zValidator("json", z.object({ isBlocked: z.boolean() })),
  async (c) => c.json(await c.get("services").access.setBlocked(paramId(c), c.req.valid("json").isBlocked)),
);

// ── Auditoria ────────────────────────────────────────────────────────────

adminRoutes.get("/access-logs", async (c) => {
  const limit = Number(c.req.query("limit") ?? 100);
  return c.json(await c.get("services").access.listAccessLogs(Number.isFinite(limit) ? limit : 100));
});

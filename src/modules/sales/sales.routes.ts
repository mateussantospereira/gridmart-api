import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { isValidCPF } from "../../utils/cpf";
import { paramId, type Env } from "../../utils/api";

export const saleRoutes = new Hono<Env>();

const buySchema = z.object({
  cpf: z.string().refine(isValidCPF, "CPF inválido"),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive().default(1),
      }),
    )
    .min(1),
});

// 1. Cria a venda + cobrança Pix a partir do carrinho do totem
saleRoutes.post("/", zValidator("json", buySchema), async (c) =>
  c.json(await c.get("services").sales.create(c.req.valid("json")), 201),
);

// 2. Status da venda (o totem faz polling até virar PAID)
saleRoutes.get("/:id", async (c) => c.json(await c.get("services").sales.get(paramId(c))));

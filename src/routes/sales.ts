import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { isValidCPF } from "../utils/cpf";
import { paramPublicId, type Env } from "../utils/api";

export const saleRoutes = new Hono<Env>();

const buySchema = z.object({
  cpf: z.string().refine(isValidCPF, "CPF inválido"),
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        quantity: z.number().int().positive().default(1),
      }),
    )
    .min(1),
});

// 1. Cria a venda a partir do carrinho do totem
saleRoutes.post("/", zValidator("json", buySchema), async (c) => {
  const { cpf, items } = c.req.valid("json");
  return c.json(await c.get("services").sales.create(cpf, items), 201);
});

// 2. Status da venda (o totem acompanha o pagamento)
saleRoutes.get("/:publicId", async (c) =>
  c.json(await c.get("services").sales.get(paramPublicId(c))),
);

// O pagamento NÃO é confirmado aqui: agora só o admin confirma
// (PUT /admin/sales/:publicId). No futuro, o webhook do Pix assume isso.

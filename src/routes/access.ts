import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { isValidCPF } from "../utils/cpf";
import type { Env } from "../utils/api";

export const accessRoutes = new Hono<Env>();

const cpfSchema = z.string().refine(isValidCPF, "CPF inválido");

// 1. Consulta o CPF (define se precisa pedir o nome)
accessRoutes.post("/check", zValidator("json", z.object({ cpf: cpfSchema })), async (c) =>
  c.json(await c.get("services").access.check(c.req.valid("json").cpf)),
);

// 2. Cadastro do primeiro acesso
accessRoutes.post(
  "/register",
  zValidator("json", z.object({ cpf: cpfSchema, name: z.string().min(2) })),
  async (c) => {
    const { cpf, name } = c.req.valid("json");
    return c.json(await c.get("services").access.register(cpf, name), 201);
  },
);

// 3. Entrada: cria a visita
accessRoutes.post("/enter", zValidator("json", z.object({ cpf: cpfSchema })), async (c) =>
  c.json(await c.get("services").access.enter(c.req.valid("json").cpf)),
);

// 4. Gera o token de saída (após o pagamento)
accessRoutes.post("/exit-token", zValidator("json", z.object({ saleId: z.number().int().positive() })), async (c) =>
  c.json(await c.get("services").access.createExitToken(c.req.valid("json").saleId)),
);

// 5. Sai usando o token (uso único)
accessRoutes.post("/exit", zValidator("json", z.object({ token: z.string().min(1) })), async (c) =>
  c.json(await c.get("services").access.exit(c.req.valid("json").token)),
);

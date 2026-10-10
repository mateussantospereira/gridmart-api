import { Hono } from "hono";
import { or404, paramId, type Env } from "../../utils/api";

export const deviceRoutes = new Hono<Env>();

// A porta/totem autentica pelo header e consome a fila de comandos.
deviceRoutes.get("/commands", async (c) => {
  await c.get("services").devices.authenticate(c.req.header("x-device-token"));
  return c.json(await c.get("services").door.pending());
});

// Confirma a execução do comando (ex.: relé acionado).
deviceRoutes.post("/commands/:id/ack", async (c) => {
  await c.get("services").devices.authenticate(c.req.header("x-device-token"));
  return or404(c, await c.get("services").door.ack(paramId(c)));
});

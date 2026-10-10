import { Hono } from "hono";
import type { Env } from "../../utils/api";

export const pixWebhookRoutes = new Hono<Env>();

// Recebe a confirmação de pagamento do provedor Pix.
// No MVP o FakePixGateway lê { txid, paid } do corpo.
pixWebhookRoutes.post("/pix", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = c.get("services").pix.parseWebhook(body);
  if (!parsed) return c.json({ error: "Payload inválido" }, 400);

  const sale = await c.get("services").sales.markPaidByTxid(parsed.txid);
  return c.json({ ok: true, saleId: sale.id, status: sale.status });
});

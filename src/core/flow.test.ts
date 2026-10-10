import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { describe, expect, it } from "bun:test";
import { createApp } from "../index";
import { devices, products } from "../db/schema";
import type { DB } from "../utils/api";

const CPF = "52998224725"; // CPF válido para testes

const migrationSql = await Bun.file(new URL("../../drizzle/0000_init.sql", import.meta.url)).text();

/** Cria um banco SQLite em memória e um app apontando para ele. */
async function setup() {
  const sqlite = new Database(":memory:");
  sqlite.exec(migrationSql);
  const db = drizzle(sqlite) as unknown as DB;

  await db.insert(devices).values({ kind: "DOOR", name: "Porta", token: "dev-door" }).run();
  const product = await db
    .insert(products)
    .values({ barcode: "7891000100103", name: "Café 500g", priceInCents: 1000 })
    .returning()
    .get();

  const app = createApp({ makeDb: () => db });

  const post = (path: string, body: unknown) =>
    app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  return { app, post, productId: product.id };
}

describe("fluxo da loja autônoma", () => {
  it("entra, compra, paga, sai e não reaproveita o token", async () => {
    const { post, productId } = await setup();

    // 1. CPF ainda não cadastrado
    let res = await post("/access/check", { cpf: CPF });
    expect(res.status).toBe(200);
    expect((await res.json()) as unknown).toEqual({ registered: false, allowed: false });

    // 2. Cadastro
    res = await post("/access/register", { cpf: CPF, name: "Ana" });
    expect(res.status).toBe(201);

    // 3. Entrada -> cria visita + comando de porta
    res = await post("/access/enter", { cpf: CPF });
    expect(res.status).toBe(200);
    const enter = (await res.json()) as { visitId: number };
    expect(enter.visitId).toBeGreaterThan(0);

    // 4. A porta tem um comando ENTRY pendente
    res = await post("/access/enter", { cpf: CPF });
    expect(res.status).toBe(409); // não abre duas visitas

    // 5. Venda a partir do carrinho
    res = await post("/sales", { cpf: CPF, items: [{ productId, quantity: 2 }] });
    expect(res.status).toBe(201);
    const sale = (await res.json()) as { id: number; status: string; totalInCents: number; pixTxid: string };
    expect(sale.status).toBe("PENDING");
    expect(sale.totalInCents).toBe(2000);

    // 6. Sem pagamento não gera token de saída
    res = await post("/access/exit-token", { saleId: sale.id });
    expect(res.status).toBe(409);

    // 7. Webhook do Pix confirma o pagamento
    res = await post("/webhooks/pix", { txid: sale.pixTxid, paid: true });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { status: string }).status).toBe("PAID");

    // 8. Gera o token de saída
    res = await post("/access/exit-token", { saleId: sale.id });
    expect(res.status).toBe(200);
    const { token } = (await res.json()) as { token: string };

    // 9. Sai usando o token
    res = await post("/access/exit", { token });
    expect(res.status).toBe(200);

    // 10. Token é de uso único
    res = await post("/access/exit", { token });
    expect(res.status).toBe(403);

    // 11. Sem visita aberta, não dá mais para vender
    res = await post("/sales", { cpf: CPF, items: [{ productId, quantity: 1 }] });
    expect(res.status).toBe(409);
  });

  it("a porta consome e confirma os comandos", async () => {
    const { app, post } = await setup();
    await post("/access/register", { cpf: CPF, name: "Ana" });
    await post("/access/enter", { cpf: CPF });

    const list = () => app.request("/devices/commands", { headers: { "x-device-token": "dev-door" } });

    let res = await list();
    expect(res.status).toBe(200);
    const commands = (await res.json()) as { id: number; kind: string }[];
    expect(commands).toHaveLength(1);
    expect(commands[0]?.kind).toBe("ENTRY");

    res = await app.request(`/devices/commands/${commands[0]?.id}/ack`, {
      method: "POST",
      headers: { "x-device-token": "dev-door" },
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { status: string }).status).toBe("DONE");

    // fila agora vazia
    expect((await (await list()).json()) as unknown[]).toHaveLength(0);
  });

  it("rejeita dispositivo com token inválido", async () => {
    const { app } = await setup();
    const res = await app.request("/devices/commands", { headers: { "x-device-token": "errado" } });
    expect(res.status).toBe(403);
  });

  it("rejeita CPF inválido", async () => {
    const { post } = await setup();
    const res = await post("/access/check", { cpf: "11111111111" });
    expect(res.status).toBe(400);
  });
});

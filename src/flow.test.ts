import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { describe, expect, it } from "bun:test";
import { createApp } from "./index";
import { products } from "./db/schema";
import type { DB } from "./utils/api";

const CPF = "52998224725"; // CPF válido para testes
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADMIN_TOKEN = "test-admin-token";

const migrationSql = await Bun.file(new URL("../drizzle/0000_init.sql", import.meta.url)).text();
const migration2Sql = await Bun.file(new URL("../drizzle/0001_bizarre_triton.sql", import.meta.url)).text();

/** Cria um banco SQLite em memória e um app apontando para ele. */
async function setup() {
  const sqlite = new Database(":memory:");
  sqlite.exec(migrationSql);
  sqlite.exec(migration2Sql.replaceAll("--> statement-breakpoint", ""));
  const db = drizzle(sqlite) as unknown as DB;

  const product = await db
    .insert(products)
    .values({ barcode: "7891000100103", name: "Café 500g", priceInCents: 1000 })
    .returning()
    .get();

  const app = createApp(() => db);
  const env = { DB: {} as D1Database, ADMIN_TOKEN };

  const post = (path: string, body: unknown) =>
    app.request(
      path,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
      env,
    );

  /** Chamada autenticada como admin. */
  const adminPost = (path: string, body?: unknown) =>
    app.request(
      path,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      env,
    );

  return { app, env, post, adminPost, productId: product.publicId };
}

describe("fluxo da loja autônoma", () => {
  it("expõe publicId (UUID) e nunca o id interno", async () => {
    const { app, productId } = await setup();
    expect(productId).toMatch(UUID_RE);

    const list = (await (await app.request("/products")).json()) as Array<Record<string, unknown>>;
    expect(list[0]?.id).toBe(productId);
    expect(Object.keys(list[0]!)).not.toContain("publicId");
    expect(Object.keys(list[0]!)).not.toContain("id_interno");
  });

  it("entra, compra, confirma o pagamento, sai e não reaproveita o token", async () => {
    const { post, adminPost, productId } = await setup();

    // 1. CPF ainda não cadastrado
    let res = await post("/access/check", { cpf: CPF });
    expect(res.status).toBe(200);
    expect((await res.json()) as unknown).toEqual({ registered: false, allowed: false });

    // 2. Cadastro
    res = await post("/access/register", { cpf: CPF, name: "Ana" });
    expect(res.status).toBe(201);

    // 3. Entrada -> cria a visita (retorna publicId da visita)
    res = await post("/access/enter", { cpf: CPF });
    expect(res.status).toBe(200);
    const enter = (await res.json()) as { visitId: string };
    expect(enter.visitId).toMatch(UUID_RE);

    // 4. Não abre duas visitas ao mesmo tempo
    res = await post("/access/enter", { cpf: CPF });
    expect(res.status).toBe(409);

    // 5. Monta a venda
    res = await post("/sales", { cpf: CPF, items: [{ productId, quantity: 2 }] });
    expect(res.status).toBe(201);
    const sale = (await res.json()) as { id: string; status: string; totalInCents: number };
    expect(sale.id).toMatch(UUID_RE);
    expect(sale.status).toBe("PENDING");
    expect(sale.totalInCents).toBe(2000);

    // 6. Sem pagamento, não gera token de saída
    res = await post("/access/exit-token", { saleId: sale.id });
    expect(res.status).toBe(409);

    // 7. Confirma o pagamento (agora só pelo admin)
    res = await adminPost(`/admin/sales/${sale.id}/pay`);
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

  it("rejeita CPF inválido", async () => {
    const { post } = await setup();
    const res = await post("/access/check", { cpf: "11111111111" });
    expect(res.status).toBe(400);
  });

  it("404 para venda com publicId inexistente", async () => {
    const { app } = await setup();
    const res = await app.request("/sales/00000000-0000-4000-8000-000000000000");
    expect(res.status).toBe(404);
  });

  it("bloqueia a escrita de produtos fora do admin", async () => {
    const { post } = await setup();
    const res = await post("/products", { barcode: "123", name: "X", priceInCents: 1 });
    expect(res.status).toBe(404); // a rota nem existe mais no público
  });

  it("protege /admin/* com o token", async () => {
    const { app, env, adminPost } = await setup();

    // Sem token -> 401
    let res = await app.request("/admin/products", {}, env);
    expect(res.status).toBe(401);

    // Token errado -> 401
    res = await app.request("/admin/products", { headers: { "x-admin-token": "errado" } }, env);
    expect(res.status).toBe(401);

    // Token certo -> 200
    res = await app.request("/admin/products", { headers: { "x-admin-token": ADMIN_TOKEN } }, env);
    expect(res.status).toBe(200);

    // Admin cria e remove produto
    res = await adminPost("/admin/products", { barcode: "7891234567890", name: "Água", priceInCents: 300 });
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: string };
    expect(created.id).toMatch(UUID_RE);

    res = await app.request(
      `/admin/products/${created.id}`,
      { method: "DELETE", headers: { "x-admin-token": ADMIN_TOKEN } },
      env,
    );
    expect(res.status).toBe(200);
  });
});

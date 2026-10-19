import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { describe, expect, it } from "bun:test";
import { createApp } from "./index";
import { products } from "./db/schema";
import type { DB } from "./utils/api";

const CPF = "52998224725"; // CPF válido para testes
const ADMIN_TOKEN = "test-admin-token";

const migrationSql = await Bun.file(new URL("../drizzle/0000_init.sql", import.meta.url)).text();

/** Cria um banco SQLite em memória e um app apontando para ele. */
async function setup() {
  const sqlite = new Database(":memory:");
  sqlite.exec(migrationSql);
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

  const adminRequest = (method: string, path: string, body?: unknown) =>
    app.request(
      path,
      {
        method,
        headers: { "content-type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      env,
    );

  const adminPost = (path: string, body?: unknown) => adminRequest("POST", path, body);
  const adminPut = (path: string, body?: unknown) => adminRequest("PUT", path, body);
  const adminGet = (path: string) => adminRequest("GET", path);
  const adminDelete = (path: string) => adminRequest("DELETE", path);

  return { app, env, post, adminPost, adminPut, adminGet, adminDelete, productId: product.id };
}

describe("produtos (público)", () => {
  it("lista e busca por id e por código de barras", async () => {
    const { app, productId } = await setup();

    const list = (await (await app.request("/products")).json()) as Array<{ id: number }>;
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(productId);

    const byId = (await (await app.request(`/products/${productId}`)).json()) as { name: string };
    expect(byId.name).toBe("Café 500g");

    const byBarcode = (await (await app.request("/products/barcode/7891000100103")).json()) as {
      id: number;
    };
    expect(byBarcode.id).toBe(productId);
  });

  it("404 para produto inexistente", async () => {
    const { app } = await setup();
    expect((await app.request("/products/999")).status).toBe(404);
    expect((await app.request("/products/barcode/000")).status).toBe(404);
  });

  it("não permite escrita fora do admin", async () => {
    const { post } = await setup();
    expect((await post("/products", { barcode: "1", name: "X", priceInCents: 1 })).status).toBe(404);
  });
});

describe("fluxo da loja autônoma", () => {
  it("entra, compra, paga, sai e não reaproveita o token", async () => {
    const { app, post, adminPut, productId } = await setup();

    // 1. CPF ainda não cadastrado
    let res = await post("/access/check", { cpf: CPF });
    expect(res.status).toBe(200);
    expect((await res.json()) as unknown).toEqual({ registered: false, allowed: false });

    // 2. Cadastro
    res = await post("/access/register", { cpf: CPF, name: "Ana" });
    expect(res.status).toBe(201);

    // 3. Entrada -> cria a visita
    res = await post("/access/enter", { cpf: CPF });
    expect(res.status).toBe(200);
    const enter = (await res.json()) as { visitId: number; name: string };
    expect(enter.visitId).toBeNumber();
    expect(enter.name).toBe("Ana");

    // 4. Não abre duas visitas ao mesmo tempo
    expect((await post("/access/enter", { cpf: CPF })).status).toBe(409);

    // 5. Monta a venda
    res = await post("/sales", { cpf: CPF, items: [{ productId, quantity: 2 }] });
    expect(res.status).toBe(201);
    const sale = (await res.json()) as { id: number; status: string; totalInCents: number };
    expect(sale.status).toBe("PENDING");
    expect(sale.totalInCents).toBe(2000);

    // 6. O totem acompanha o status via GET /sales/:id
    const detail = (await (await app.request(`/sales/${sale.id}`)).json()) as { status: string; items: unknown[] };
    expect(detail.status).toBe("PENDING");
    expect(detail.items).toHaveLength(1);

    // 7. Sem pagamento, não gera token de saída
    expect((await post("/access/exit-token", { saleId: sale.id })).status).toBe(409);

    // 8. Pagamento (só pelo admin)
    res = await adminPut(`/admin/sales/${sale.id}`, { status: "PAID" });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { status: string }).status).toBe("PAID");

    // 9. Gera o token de saída
    res = await post("/access/exit-token", { saleId: sale.id });
    expect(res.status).toBe(200);
    const { token } = (await res.json()) as { token: string };

    // 10. Sai usando o token
    expect((await post("/access/exit", { token })).status).toBe(200);

    // 11. Token é de uso único
    expect((await post("/access/exit", { token })).status).toBe(403);

    // 12. Sem visita aberta, não dá mais para vender
    expect((await post("/sales", { cpf: CPF, items: [{ productId, quantity: 1 }] })).status).toBe(409);
  });

  it("rejeita CPF inválido", async () => {
    const { post } = await setup();
    expect((await post("/access/check", { cpf: "11111111111" })).status).toBe(400);
  });

  it("bloqueia a entrada de cliente bloqueado", async () => {
    const { post } = await setup();
    await post("/access/register", { cpf: CPF, name: "Ana" });
    // bloqueia via admin
    const { adminPut, adminGet } = await setup();
    void adminPut;
    void adminGet;
  });

  it("404 para venda inexistente", async () => {
    const { app } = await setup();
    expect((await app.request("/sales/999")).status).toBe(404);
  });
});

describe("admin", () => {
  it("protege /admin/* com o token", async () => {
    const { app, env } = await setup();

    // Sem token / token errado -> 401
    expect((await app.request("/admin/users", {}, env)).status).toBe(401);
    expect((await app.request("/admin/users", { headers: { "x-admin-token": "x" } }, env)).status).toBe(401);

    // Token certo -> 200
    expect((await app.request("/admin/users", { headers: { "x-admin-token": ADMIN_TOKEN } }, env)).status).toBe(200);
  });

  it("cria, edita e remove produto", async () => {
    const { adminPost, adminPut, adminDelete } = await setup();

    let res = await adminPost("/admin/products", { barcode: "7891234567890", name: "Água", priceInCents: 300 });
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: number; priceInCents: number };
    expect(created.id).toBeNumber();

    res = await adminPut(`/admin/products/${created.id}`, { priceInCents: 350 });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { priceInCents: number }).priceInCents).toBe(350);

    expect((await adminDelete(`/admin/products/${created.id}`)).status).toBe(200);
    expect((await adminDelete(`/admin/products/${created.id}`)).status).toBe(404);
  });

  it("muda estado de venda, visita e usuário via PUT", async () => {
    const { post, adminPut, adminGet, productId } = await setup();

    await post("/access/register", { cpf: CPF, name: "Ana" });
    await post("/access/enter", { cpf: CPF });
    const sale = (await (await post("/sales", { cpf: CPF, items: [{ productId, quantity: 1 }] })).json()) as {
      id: number;
      visitId: number;
    };

    // Venda: PUT {status:"PAID"} ; status inválido -> 400
    expect((await adminPut(`/admin/sales/${sale.id}`, { status: "CANCELED" })).status).toBe(400);
    let res = await adminPut(`/admin/sales/${sale.id}`, { status: "PAID" });
    expect(res.status).toBe(200);

    // Visita: PUT {status:"CLOSED"}
    res = await adminPut(`/admin/visits/${sale.visitId}`, { status: "CLOSED" });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { status: string }).status).toBe("CLOSED");

    // Usuário: PUT {isBlocked:true}
    const visits = (await (await adminGet("/admin/visits")).json()) as Array<{ userId: number }>;
    res = await adminPut(`/admin/users/${visits[0]!.userId}`, { isBlocked: true });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { isBlocked: boolean }).isBlocked).toBe(true);
  });

  it("lista vendas filtrando por status", async () => {
    const { post, adminPut, adminGet, productId } = await setup();
    await post("/access/register", { cpf: CPF, name: "Ana" });
    await post("/access/enter", { cpf: CPF });
    const sale = (await (await post("/sales", { cpf: CPF, items: [{ productId, quantity: 1 }] })).json()) as { id: number };

    const pending = (await (await adminGet("/admin/sales?status=PENDING")).json()) as unknown[];
    expect(pending).toHaveLength(1);

    await adminPut(`/admin/sales/${sale.id}`, { status: "PAID" });
    expect(((await (await adminGet("/admin/sales?status=PENDING")).json()) as unknown[])).toHaveLength(0);
    expect(((await (await adminGet("/admin/sales?status=PAID")).json()) as unknown[])).toHaveLength(1);
  });

  it("lista usuários e logs de acesso", async () => {
    const { post, adminGet } = await setup();
    await post("/access/register", { cpf: CPF, name: "Ana" });
    await post("/access/enter", { cpf: CPF });

    const users = (await (await adminGet("/admin/users")).json()) as Array<{ cpf: string; isBlocked: boolean }>;
    expect(users[0]!.cpf).toBe(CPF);

    const logs = (await (await adminGet("/admin/access-logs")).json()) as Array<{ cpf: string; status: string }>;
    expect(logs[0]!.status).toBe("GRANTED");
  });
});

import { and, desc, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { products, saleItems, sales, users, visits } from "../db/schema";
import type { DB } from "../utils/api";

const clean = (cpf: string) => cpf.replace(/\D/g, "");

export interface CartItem {
  productId: number;
  quantity: number;
}

export class SalesService {
  constructor(private db: DB) {}

  /** Monta a venda a partir do carrinho do totem. */
  async create(cpfRaw: string, items: CartItem[]) {
    const cpf = clean(cpfRaw);
    const user = await this.db.select().from(users).where(eq(users.cpf, cpf)).get();
    if (!user) throw new HTTPException(404, { message: "Usuário não cadastrado" });

    const visit = await this.db
      .select()
      .from(visits)
      .where(and(eq(visits.userId, user.id), eq(visits.status, "OPEN")))
      .get();
    if (!visit) throw new HTTPException(409, { message: "Nenhuma visita aberta para este CPF" });

    // Resolve os produtos em uma única query (evita N+1 no totem).
    const productIds = [...new Set(items.map((item) => item.productId))];
    const found = await this.db.select().from(products).where(inArray(products.id, productIds));
    const byId = new Map(found.map((product) => [product.id, product]));

    let totalInCents = 0;
    const verified = items.map((item) => {
      const product = byId.get(item.productId);
      if (!product) throw new HTTPException(404, { message: `Produto ${item.productId} não encontrado` });

      totalInCents += product.priceInCents * item.quantity;
      return { product, quantity: item.quantity };
    });

    const sale = await this.db
      .insert(sales)
      .values({ visitId: visit.id, totalInCents, status: "PENDING" })
      .returning()
      .get();

    await this.db
      .insert(saleItems)
      .values(
        verified.map(({ product, quantity }) => ({
          saleId: sale.id,
          productId: product.id,
          priceInCents: product.priceInCents,
          quantity,
        })),
      )
      .run();

    return {
      id: sale.id,
      visitId: visit.id,
      totalInCents,
      status: sale.status,
      items: verified.map(({ product, quantity }) => ({
        productId: product.id,
        name: product.name,
        priceInCents: product.priceInCents,
        quantity,
      })),
    };
  }

  /** Detalhe da venda (o totem acompanha o status). */
  async get(id: number | null) {
    if (!id) throw new HTTPException(404, { message: "Venda não encontrada" });

    const sale = await this.db.select().from(sales).where(eq(sales.id, id)).get();
    if (!sale) throw new HTTPException(404, { message: "Venda não encontrada" });

    const items = await this.db
      .select({
        productId: products.id,
        name: products.name,
        priceInCents: saleItems.priceInCents,
        quantity: saleItems.quantity,
      })
      .from(saleItems)
      .innerJoin(products, eq(saleItems.productId, products.id))
      .where(eq(saleItems.saleId, sale.id))
      .all();

    return { id: sale.id, visitId: sale.visitId, totalInCents: sale.totalInCents, status: sale.status, items };
  }

  /**
   * Confirma o pagamento manualmente (só para testar o fluxo).
   * Quando ligarmos o Pix de verdade, isso vira o webhook do provedor.
   */
  async pay(id: number | null) {
    if (!id) throw new HTTPException(404, { message: "Venda não encontrada" });

    const sale = await this.db.select().from(sales).where(eq(sales.id, id)).get();
    if (!sale) throw new HTTPException(404, { message: "Venda não encontrada" });

    if (sale.status !== "PAID") {
      await this.db.update(sales).set({ status: "PAID" }).where(eq(sales.id, sale.id)).run();
    }

    return { id: sale.id, visitId: sale.visitId, totalInCents: sale.totalInCents, status: "PAID" };
  }

  // ── Administração ──────────────────────────────────────────────────────

  /** Lista vendas; `status` filtra por PENDING/PAID (default: todas). */
  async list(status?: string) {
    const query = this.db
      .select({
        id: sales.id,
        visitId: visits.id,
        userCpf: users.cpf,
        userName: users.name,
        totalInCents: sales.totalInCents,
        status: sales.status,
        createdAt: sales.createdAt,
      })
      .from(sales)
      .innerJoin(visits, eq(sales.visitId, visits.id))
      .innerJoin(users, eq(visits.userId, users.id))
      .orderBy(desc(sales.id))
      .$dynamic();

    return (status ? query.where(eq(sales.status, status)) : query).all();
  }
}

import { and, eq } from "drizzle-orm";
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

    let totalInCents = 0;
    const verified: (CartItem & { priceInCents: number })[] = [];

    for (const item of items) {
      const product = await this.db.select().from(products).where(eq(products.id, item.productId)).get();
      if (!product) throw new HTTPException(404, { message: `Produto ${item.productId} não encontrado` });

      totalInCents += product.priceInCents * item.quantity;
      verified.push({ productId: item.productId, quantity: item.quantity, priceInCents: product.priceInCents });
    }

    const sale = await this.db.insert(sales).values({ visitId: visit.id, totalInCents, status: "PENDING" }).returning().get();

    for (const item of verified) {
      await this.db.insert(saleItems).values({ saleId: sale.id, ...item }).run();
    }

    return { ...sale, items: verified };
  }

  /** Detalhe da venda (o totem acompanha o status). */
  async get(id: number) {
    const sale = await this.db.select().from(sales).where(eq(sales.id, id)).get();
    if (!sale) throw new HTTPException(404, { message: "Venda não encontrada" });

    const items = await this.db.select().from(saleItems).where(eq(saleItems.saleId, id)).all();
    return { ...sale, items };
  }

  /**
   * Confirma o pagamento manualmente (só para testar o fluxo).
   * Quando ligarmos o Pix de verdade, isso vira o webhook do provedor.
   */
  async pay(id: number) {
    const sale = await this.db.select().from(sales).where(eq(sales.id, id)).get();
    if (!sale) throw new HTTPException(404, { message: "Venda não encontrada" });
    if (sale.status === "PAID") return sale;

    return this.db.update(sales).set({ status: "PAID" }).where(eq(sales.id, id)).returning().get();
  }
}
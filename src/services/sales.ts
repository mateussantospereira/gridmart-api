import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { products, saleItems, sales, users, visits } from "../db/schema";
import type { DB } from "../utils/api";

const clean = (cpf: string) => cpf.replace(/\D/g, "");

export interface CartItem {
  productId: string; // publicId do produto
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
    const found = await this.db.select().from(products).where(inArray(products.publicId, productIds));
    const byPublicId = new Map(found.map((product) => [product.publicId, product]));

    let totalInCents = 0;
    const verified = items.map((item) => {
      const product = byPublicId.get(item.productId);
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
      id: sale.publicId,
      visitId: visit.publicId,
      totalInCents,
      status: sale.status,
      items: verified.map(({ product, quantity }) => ({
        productId: product.publicId,
        name: product.name,
        priceInCents: product.priceInCents,
        quantity,
      })),
    };
  }

  /** Detalhe da venda (o totem acompanha o status). */
  async get(publicId: string | null) {
    if (!publicId) throw new HTTPException(404, { message: "Venda não encontrada" });

    const sale = await this.db.select().from(sales).where(eq(sales.publicId, publicId)).get();
    if (!sale) throw new HTTPException(404, { message: "Venda não encontrada" });

    const visit = await this.db.select().from(visits).where(eq(visits.id, sale.visitId)).get();
    const items = await this.db
      .select({
        productId: products.publicId,
        name: products.name,
        priceInCents: saleItems.priceInCents,
        quantity: saleItems.quantity,
      })
      .from(saleItems)
      .innerJoin(products, eq(saleItems.productId, products.id))
      .where(eq(saleItems.saleId, sale.id))
      .all();

    return {
      id: sale.publicId,
      visitId: visit?.publicId ?? null,
      totalInCents: sale.totalInCents,
      status: sale.status,
      items,
    };
  }

  /**
   * Confirma o pagamento manualmente (só para testar o fluxo).
   * Quando ligarmos o Pix de verdade, isso vira o webhook do provedor.
   */
  async pay(publicId: string | null) {
    if (!publicId) throw new HTTPException(404, { message: "Venda não encontrada" });

    const sale = await this.db.select().from(sales).where(eq(sales.publicId, publicId)).get();
    if (!sale) throw new HTTPException(404, { message: "Venda não encontrada" });
    if (sale.status === "PAID") {
      const visit = await this.db.select().from(visits).where(eq(visits.id, sale.visitId)).get();
      return { id: sale.publicId, visitId: visit?.publicId ?? null, totalInCents: sale.totalInCents, status: sale.status };
    }

    const updated = await this.db.update(sales).set({ status: "PAID" }).where(eq(sales.id, sale.id)).returning().get();
    const visit = await this.db.select().from(visits).where(eq(visits.id, updated.visitId)).get();

    return { id: updated.publicId, visitId: visit?.publicId ?? null, totalInCents: updated.totalInCents, status: updated.status };
  }
}

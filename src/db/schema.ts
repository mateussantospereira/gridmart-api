import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

const now = () => new Date().toISOString();

// 1. USUÁRIOS (quem pode entrar na loja)
export const users = sqliteTable("users", {
  id: integer().primaryKey({ autoIncrement: true }),
  cpf: text().notNull().unique(),
  name: text().notNull(),
  isBlocked: integer({ mode: "boolean" }).notNull().default(false),
  createdAt: text().notNull().$defaultFn(now),
});

// 2. PRODUTOS (catálogo lido pelo leitor de código de barras)
export const products = sqliteTable("products", {
  id: integer().primaryKey({ autoIncrement: true }),
  barcode: text().notNull().unique(),
  name: text().notNull(),
  priceInCents: integer().notNull(),
});

// 3. VISITAS (a "sessão" de uma pessoa dentro da loja)
export const visits = sqliteTable("visits", {
  id: integer().primaryKey({ autoIncrement: true }),
  userId: integer()
    .notNull()
    .references(() => users.id),
  status: text().notNull().default("OPEN"), // 'OPEN' | 'CLOSED'
  exitToken: text(),
  exitTokenExpiresAt: text(),
  enteredAt: text().notNull().$defaultFn(now),
  exitedAt: text(),
});

// 4. VENDAS (cabeçalho da transação do totem)
export const sales = sqliteTable("sales", {
  id: integer().primaryKey({ autoIncrement: true }),
  visitId: integer()
    .notNull()
    .references(() => visits.id),
  totalInCents: integer().notNull(),
  status: text().notNull().default("PENDING"), // 'PENDING' | 'PAID'
  createdAt: text().notNull().$defaultFn(now),
});

// 5. ITENS DA VENDA (carrinho consolidado por produto)
export const saleItems = sqliteTable("sale_items", {
  id: integer().primaryKey({ autoIncrement: true }),
  saleId: integer()
    .notNull()
    .references(() => sales.id),
  productId: integer()
    .notNull()
    .references(() => products.id),
  priceInCents: integer().notNull(),
  quantity: integer().notNull(),
});

// 6. LOGS DE ACESSO (auditoria de entrada/saída)
export const accessLogs = sqliteTable("access_logs", {
  id: integer().primaryKey({ autoIncrement: true }),
  cpf: text().notNull(),
  status: text().notNull(), // 'GRANTED' | 'DENIED'
  createdAt: text().notNull().$defaultFn(now),
});
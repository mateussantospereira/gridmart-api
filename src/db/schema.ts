import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const now = () => new Date().toISOString();

/**
 * Identidade pública: o `id` inteiro nunca sai da API.
 * Toda tabela exposta usa `publicId` (UUID) como referência externa.
 *
 * `$defaultFn` gera o UUID no runtime do Drizzle (Workers/Bun).
 * O `default` com SQL cobre inserts que NÃO passam pelo Drizzle
 * (seed.sql, scripts, ESP32) — o SQLite gera um UUID v4 sozinho.
 */
const UUID_V4_SQL = sql`(
  lower(hex(randomblob(4))) || '-' ||
  lower(hex(randomblob(2))) || '-4' ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  lower(hex(randomblob(6)))
)`;

const publicId = () =>
  text()
    .notNull()
    .unique()
    .default(UUID_V4_SQL)
    .$defaultFn(() => crypto.randomUUID());

// 1. USUÁRIOS (quem pode entrar na loja)
export const users = sqliteTable("users", {
  id: integer().primaryKey({ autoIncrement: true }),
  publicId: publicId(),
  cpf: text().notNull().unique(),
  name: text().notNull(),
  isBlocked: integer({ mode: "boolean" }).notNull().default(false),
  createdAt: text().notNull().$defaultFn(now),
});

// 2. PRODUTOS (catálogo lido pelo leitor de código de barras)
export const products = sqliteTable("products", {
  id: integer().primaryKey({ autoIncrement: true }),
  publicId: publicId(),
  barcode: text().notNull().unique(),
  name: text().notNull(),
  priceInCents: integer().notNull(),
});

// 3. VISITAS (a "sessão" de uma pessoa dentro da loja)
export const visits = sqliteTable("visits", {
  id: integer().primaryKey({ autoIncrement: true }),
  publicId: publicId(),
  userId: integer()
    .notNull()
    .references(() => users.id),
  status: text().notNull().default("OPEN"),
  exitToken: text(),
  exitTokenExpiresAt: text(),
  enteredAt: text().notNull().$defaultFn(now),
  exitedAt: text(),
});

// 4. VENDAS (cabeçalho da transação do totem)
export const sales = sqliteTable("sales", {
  id: integer().primaryKey({ autoIncrement: true }),
  publicId: publicId(),
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
  publicId: publicId(),
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
// Auditoria interna não é exposta por API, mas mantém publicId por consistência.
export const accessLogs = sqliteTable("access_logs", {
  id: integer().primaryKey({ autoIncrement: true }),
  publicId: publicId(),
  cpf: text().notNull(),
  status: text().notNull(), // 'GRANTED' | 'DENIED'
  createdAt: text().notNull().$defaultFn(now),
});

# GridMart API 🛒⚡

API edge-first para lojas autônomas e micro-mercados inteligentes (totem de autoatendimento, controle de acesso e checkout Pix).

## 🛠️ Stack Tecnológica

- **Runtime**: [Bun](https://bun.com)
- **Framework**: [Hono](https://hono.dev)
- **Deploy & Infra**: [Cloudflare Workers](https://workers.cloudflare.com/)
- **Banco de Dados**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite na borda)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Validação**: [Zod](https://zod.dev) & [drizzle-zod](https://orm.drizzle.team/docs/zod)

## 📁 Estrutura

```
src/
├── index.ts            # monta o app
├── routes/             # rotas (products, access, sales)
├── services/           # regras da loja
├── db/schema.ts        # banco de dados
├── utils/              # api (banco/helpers) e cpf
├── middlewares/        # tratamento de erros
└── flow.test.ts        # teste do fluxo completo
```

## 🚀 Como Rodar Localmente

1. **Instalar dependências**:
   ```bash
   bun install
   ```

2. **Criar o banco local** (migração + dados de exemplo):
   ```bash
   bun run db:migrate
   bun run db:seed
   ```

3. **Iniciar servidor de desenvolvimento** (com Cloudflare D1 local via Wrangler):
   ```bash
   bun run dev
   ```

4. **Executar testes**:
   ```bash
   bun test
   ```

5. **Verificar tipagem**:
   ```bash
   bun run typecheck
   ```

6. **Migrações de Banco de Dados**:
   ```bash
   bun run db:generate # Gera novos arquivos SQL com base no schema.ts
   bun run db:migrate  # Aplica as migrações no D1 local
   ```

## 🔑 Identidade pública (UUID)

O `id` interno (inteiro) é só para joins/FKs e **nunca aparece** nas respostas.
A API expõe `publicId` (UUID v4) em todas as tabelas — o campo `id` das respostas
é o UUID. Aceita-se apenas UUID nas rotas com `:publicId`; qualquer outra coisa
retorna 404.

> O UUID é gerado pelo **banco** (default SQL), então inserts fora do Drizzle
> (seed, scripts, ESP32) também ganham `publicId` automaticamente.

## 📦 Rotas da API

### Produtos (`/products`) — catálogo público, somente leitura
- `GET /` — lista todos
- `GET /:publicId` — um produto (UUID)
- `GET /barcode/:barcode` — por código de barras (leitor do totem)

### Acesso (`/access`)
- `POST /check` `{cpf}` — o CPF já é cadastrado? (para saber se pede o nome)
- `POST /register` `{cpf, name}` — cadastro do 1º acesso (retorna `userId` UUID)
- `POST /enter` `{cpf}` — entra na loja (cria a visita, retorna `visitId` UUID)
- `POST /exit-token` `{saleId}` — gera token de saída (uso único, 25s) — `saleId` é UUID
- `POST /exit` `{token}` — sai usando o token

### Vendas (`/sales`)
- `POST /` `{cpf, items:[{productId, quantity}]}` — monta a venda (`PENDING`) — `productId` é UUID
- `GET /:publicId` — status da venda

### Admin (`/admin`) — requer o header `x-admin-token`

Toda a **escrita** vive aqui. O catálogo público é somente leitura.
A mudança de estado é sempre `PUT /recurso/:publicId` com um corpo
descrevendo o novo estado — sem verbos na URL.

- `GET|POST /products`, `PUT|DELETE /products/:publicId` — CRUD do catálogo
- `GET /sales?status=PENDING|PAID` — lista vendas
- `PUT /sales/:publicId` `{status:"PAID"}` — confirma o pagamento (no lugar do webhook do Pix)
- `GET /visits?status=OPEN|CLOSED` — quem está dentro
- `PUT /visits/:publicId` `{status:"CLOSED"}` — fecha a visita
- `GET /users` — clientes cadastrados
- `PUT /users/:publicId` `{isBlocked}` — bloqueia/desbloqueia
- `GET /access-logs?limit=100` — auditoria de acesso

> **Segurança:** o token é comparado em tempo constante e a rota falha **fechada**
> (se `ADMIN_TOKEN` não estiver configurado, nega tudo). Em dev o valor está em
> `wrangler.jsonc`; em produção use `wrangler secret put ADMIN_TOKEN`.

## 🔄 Fluxo (MVP)

1. Cliente lê o QR da porta → `POST /access/check` (e `register` se for a 1ª vez).
2. `POST /access/enter` → cria a **visita** (pessoa está dentro).
3. O totem monta o carrinho → `POST /sales` → venda `PENDING`.
4. `PUT /admin/sales/:publicId` `{status:"PAID"}` confirma o pagamento → venda `PAID`.
5. `POST /access/exit-token` → gera token de saída (uso único, 25s).
6. `POST /access/exit` → valida o token e fecha a visita.

> O **ESP32** (abertura da porta) e o **Pix real** ficaram para depois: a porta ainda não é controlada pela API, e o pagamento é confirmado pelo admin em `PUT /admin/sales/:publicId`.


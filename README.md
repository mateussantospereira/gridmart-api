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

## 📦 Rotas da API

### Produtos (`/products`)
- `GET /` — lista todos
- `GET /:id` — um produto
- `GET /barcode/:barcode` — por código de barras (leitor do totem)
- `POST /` `{barcode, name, priceInCents}` — cria
- `PUT /:id` — atualiza
- `DELETE /:id` — remove

### Acesso (`/access`)
- `POST /check` `{cpf}` — o CPF já é cadastrado? (para saber se pede o nome)
- `POST /register` `{cpf, name}` — cadastro do 1º acesso
- `POST /enter` `{cpf}` — entra na loja (cria a visita)
- `POST /exit-token` `{saleId}` — gera token de saída (uso único, 25s)
- `POST /exit` `{token}` — sai usando o token

### Vendas (`/sales`)
- `POST /` `{cpf, items:[{productId, quantity}]}` — monta a venda (`PENDING`)
- `GET /:id` — status da venda
- `POST /:id/pay` — confirma o pagamento **manualmente** (dev; no futuro será o webhook do Pix)

## 🔄 Fluxo (MVP)

1. Cliente lê o QR da porta → `POST /access/check` (e `register` se for a 1ª vez).
2. `POST /access/enter` → cria a **visita** (pessoa está dentro).
3. O totem monta o carrinho → `POST /sales` → venda `PENDING`.
4. `POST /sales/:id/pay` confirma o pagamento → venda `PAID`.
5. `POST /access/exit-token` → gera token de saída (uso único, 25s).
6. `POST /access/exit` → valida o token e fecha a visita.

> O **ESP32** (abertura da porta) e o **Pix real** ficaram para depois: a porta ainda não é controlada pela API, e o pagamento é confirmado manualmente em `POST /sales/:id/pay`.


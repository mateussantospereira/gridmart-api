# GridMart API 🛒⚡

API edge-first para lojas autônomas e micro-mercados inteligentes (totem de autoatendimento, controle de acesso e checkout Pix).

## 🛠️ Stack Tecnológica

- **Runtime**: [Bun](https://bun.com)
- **Framework**: [Hono](https://hono.dev)
- **Deploy & Infra**: [Cloudflare Workers](https://workers.cloudflare.com/)
- **Banco de Dados**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite na borda)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Validação**: [Zod](https://zod.dev) & [drizzle-zod](https://orm.drizzle.team/docs/zod)

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

## 📦 Módulos da API

- **Produtos** (`/products`): Cadastro e consulta por ID ou código de barras (leitor do totem).
- **Acesso** (`/access`): Validação de CPF, cadastro, **entrada** (abre a porta e cria a visita) e **saída** com token de uso único.
- **Vendas** (`/sales`): Carrinho do totem → venda + cobrança Pix; polling de status.
- **Dispositivos** (`/devices`): Fila de comandos da porta consumida pelo ESP32/ponte (autenticação por token).
- **Webhooks** (`/webhooks/pix`): Confirmação de pagamento do provedor Pix (fake no MVP).

## 🔄 Fluxo (MVP)

1. Cliente lê o QR da porta → `POST /access/check` (e `register` se for a 1ª vez).
2. `POST /access/enter` → cria a **visita** e enfileira o comando `ENTRY` na porta.
3. O totem monta o carrinho → `POST /sales` → vira uma cobrança Pix (`PENDING`).
4. Pagamento confirmado chega em `POST /webhooks/pix` → venda `PAID` (totem acompanha via `GET /sales/:id`).
5. `POST /access/exit-token` → gera token de saída (uso único, 25s).
6. `POST /access/exit` → valida o token, fecha a visita e enfileira o comando `EXIT`.

> A porta (a leitura da fila) ainda é **mockada**: o ESP32/ponte vai consumir `GET /devices/commands` + `POST /devices/commands/:id/ack` com o header `x-device-token`. O Pix também é **fake** (payload local + webhook manual) — portas/adapters prontos para plugar o provedor real.


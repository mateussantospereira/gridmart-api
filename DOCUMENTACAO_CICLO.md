# 📘 Documentação Técnica do Ciclo de Desenvolvimento - GridMart API

> **Registro Técnico das Features, Refatorações e Melhorias de Arquitetura**  
> **Repositório**: [`gridmart-api`](file:///c:/Users/Usuario/gridmart-api)  
> **Escopo do Ciclo**: Commits `570697d` até `6602d86`  
> **Status**: Concluído e Validado

---

## 📑 Sumário

1. [Visão Geral do Ciclo](#1-visão-geral-do-ciclo)
2. [Histórico e Linha do Tempo dos Commits](#2-histórico-e-linha-do-tempo-dos-commits)
3. [Detalhamento Técnico das Features Implementadas](#3-detalhamento-técnico-das-features-implementadas)
   - [3.1. Modelagem do Banco de Dados e Migrações D1 (Drizzle ORM)](#31-modelagem-do-banco-de-dados-e-migrações-d1-drizzle-orm)
   - [3.2. Controle de Acesso e Fila de Hardware IoT (`/access`)](#32-controle-de-acesso-e-fila-de-hardware-iot-access)
   - [3.3. Refatoração do Firmware ESP32 (Evolução de Server para Polling Client)](#33-refatoração-do-firmware-esp32-evolução-de-server-para-polling-client)
   - [3.4. Módulo de Vendas: Vínculo de Comprador e Abstração Pix (`/sales`)](#34-módulo-de-vendas-vínculo-de-comprador-e-abstração-pix-sales)
   - [3.5. Factory Genérica de CRUD Reutilizável (`crud.ts`)](#35-factory-genérica-de-crud-reutilizável-crudts)
   - [3.6. Tratamento de Erros, Resiliência e Validações Globais](#36-tratamento-de-erros-resiliência-e-validações-globais)
   - [3.7. Higienização de Código e Remoção de Arquivos Obsoletos](#37-higienização-de-código-e-remoção-de-arquivos-obsoletos)
4. [Tabela Comparativa: Antes vs. Depois](#4-tabela-comparativa-antes-vs-depois)
5. [Impacto no Ecossistema Integrado (Frontend & IoT)](#5-impacto-no-ecossistema-integrado-frontend--iot)
6. [Instruções de Execução, Testes e Verificação](#6-instruções-de-execução-testes-e-verificação)

---

## 1. Visão Geral do Ciclo

O objetivo deste ciclo de desenvolvimento foi consolidar a API da GridMart de um estado preliminar de protótipo (onde rotas críticas estavam anotadas como *"em desenvolvimento"*) para uma **infraestrutura de produção completa, robusta e modular**, totalmente preparada para execução no **Cloudflare Workers com D1 (SQLite na borda)**.

### Objetivos Alcançados:
- **Desacoplamento de Hardware**: Implementação de fila persistida de liberação de porta via polling seguro autenticado, eliminando a fragilidade de portas abertas na rede local.
- **Segurança de Acesso e Auditoria**: Registro completo de entradas (`ENTRY`) e saídas (`EXIT`), com suporte a saídas anônimas e controle de bloqueio de inadimplência (`isBlocked`).
- **Integridade Contábil no Checkout**: Vendas vinculáveis a compradores registrados (`users`), validação obrigatória de produtos no catálogo, preservação de snapshot de preço unitário e geração padronizada de payload Pix padrão BR Code / EMV.
- **Arquitetura DRY (Don't Repeat Yourself)**: Factory genérica de CRUD para Hono e Drizzle ORM, reduzindo a complexidade de rotas repetitivas.
- **Tratamento de Exceções**: Detecção automática de violações de unicidade (`UNIQUE constraint failed`) do SQLite retornando `409 Conflict`.

---

## 2. Histórico e Linha do Tempo dos Commits

| Commit | Mensagem do Commit | Arquivos Principais Impactados |
| :--- | :--- | :--- |
| [`570697d`](file:///c:/Users/Usuario/gridmart-api/) | `feat(db): migrações de porta, logs de acesso e venda` | [`src/db/schema.ts`](file:///c:/Users/Usuario/gridmart-api/src/db/schema.ts), `drizzle/0001_dry_inhumans.sql`, `drizzle/0002_breezy_demogoblin.sql`, `package.json` |
| [`0a0c166`](file:///c:/Users/Usuario/gridmart-api/) | `feat(access): fila de liberação de porta consumida via polling` | [`src/modules/access/access.routes.ts`](file:///c:/Users/Usuario/gridmart-api/src/modules/access/access.routes.ts), [`esp32/door_lock.ino`](file:///c:/Users/Usuario/gridmart-api/esp32/door_lock.ino), [`src/middlewares/errorHandler.ts`](file:///c:/Users/Usuario/gridmart-api/src/middlewares/errorHandler.ts), [`src/utils/api.ts`](file:///c:/Users/Usuario/gridmart-api/src/utils/api.ts), [`wrangler.jsonc`](file:///c:/Users/Usuario/gridmart-api/wrangler.jsonc) |
| [`878de0b`](file:///c:/Users/Usuario/gridmart-api/) | `refactor(products): CRUD genérico reutilizável` | [`src/utils/crud.ts`](file:///c:/Users/Usuario/gridmart-api/src/utils/crud.ts), [`src/modules/products/products.routes.ts`](file:///c:/Users/Usuario/gridmart-api/src/modules/products/products.routes.ts) |
| [`1ca4e24`](file:///c:/Users/Usuario/gridmart-api/) | `feat(sales): vincula comprador e abstrai emissão Pix` | [`src/modules/sales/sales.routes.ts`](file:///c:/Users/Usuario/gridmart-api/src/modules/sales/sales.routes.ts) |
| [`6602d86`](file:///c:/Users/Usuario/gridmart-api/) | `chore: remove código e arquivos não utilizados` | `src/gridmart-api/LICENSE` (removido), `src/middlewares/auto404.ts` (removido) |

---

## 3. Detalhamento Técnico das Features Implementadas

### 3.1. Modelagem do Banco de Dados e Migrações D1 (Drizzle ORM)

No arquivo [`src/db/schema.ts`](file:///c:/Users/Usuario/gridmart-api/src/db/schema.ts), as seguintes alterações estruturais foram consolidadas:

1. **Criação da tabela `door_commands`**:
   - Fila de liberação da trava física consumida de forma FIFO pelo ESP32.
   - Campos:
     - `id`: `integer().primaryKey({ autoIncrement: true })`
     - `createdAt`: `text().notNull().$defaultFn(() => new Date().toISOString())`

2. **Evolução da tabela `access_logs`**:
   - `cpf`: Alterado para **nullable** para viabilizar saídas anônimas (onde o cliente aciona o botão de saída sem obrigatoriedade de digitar o CPF).
   - `type`: Novo campo tipado com enum `["ENTRY", "EXIT"]` para diferenciar tentativas de ingresso e de egressão.
   - `status`: Campo enum `["GRANTED", "DENIED"]`.

3. **Evolução da tabela `sales`**:
   - `userId`: Adicionada chave estrangeira opcional (`integer().references(() => users.id)`), permitindo que a venda seja associada a um comprador cadastrado ou permaneça avulsa (`null`).
   - `status`: Tipado formalmente com enum SQLite `["PENDING", "PAID", "EXPIRED"]`.

4. **Geração das Migrações SQL**:
   - `drizzle/0001_dry_inhumans.sql`: Criação da tabela `door_commands` e reestruturação de `access_logs`.
   - `drizzle/0002_breezy_demogoblin.sql`: Adição de `userId` e constraints de status em `sales`.

```typescript
// src/db/schema.ts
export const doorCommands = sqliteTable("door_commands", {
  id: integer().primaryKey({ autoIncrement: true }),
  createdAt: text().notNull().$defaultFn(() => new Date().toISOString()),
});
```

---

### 3.2. Controle de Acesso e Fila de Hardware IoT (`/access`)

Implementado em [`src/modules/access/access.routes.ts`](file:///c:/Users/Usuario/gridmart-api/src/modules/access/access.routes.ts):

#### A. O Problema da Abordagem Anterior:
Originalmente, a trava dependia de um servidor HTTP executado diretamente no microcontrolador ESP32 na rede local. Isso apresentava falhas críticas:
- Exigia IP fixo ou port-forwarding no roteador da loja.
- A API na nuvem precisava disparar requisições para a rede física local (bloqueada por NAT/Firewall).
- Caso o ESP32 estivesse temporariamente offline ou a conexão oscilasse, a requisição do usuário na interface travava ou falhava.

#### B. A Solução Implementada (Fila com Polling Seguro):
1. **Enfileiramento Não-Bloqueante**:
   - Quando o acesso é autorizado (`/check`, `/register` ou `/exit`), a API insere um registro na tabela `door_commands` e registra a tentativa em `access_logs`.
2. **Consumo Seguro (`GET /access/door`)**:
   - O ESP32 realiza polling a cada `500ms`.
   - Validação de cabeçalho: `x-door-token === c.env.DOOR_TOKEN`. Se inválido ou ausente, responde `401 Unauthorized`.
   - Busca o primeiro comando por ordem de inserção (`orderBy(asc(doorCommands.id)).limit(1)`).
   - Se houver comando, **deleta atomicamente** o registro da fila e o retorna em formato JSON. Se a fila estiver vazia, retorna `null` com status `200 OK`.

#### C. Endpoints do Módulo:
- `POST /access/check`: Valida CPF com algoritmo módulo 11. Se usuário existe e não está bloqueado, enfileira abertura e retorna `200 OK` com `{ registered: true, allowed: true, name: user.name }`. Se bloqueado, registra log `DENIED` e retorna `403 Forbidden`. Se não cadastrado, retorna `{ registered: false, allowed: false }`.
- `POST /access/register`: Valida CPF e nome. Insere usuário, registra log `ENTRY/GRANTED`, enfileira abertura e retorna `201 Created`.
- `POST /access/exit`: Registra log `EXIT/GRANTED` (com CPF se fornecido) e enfileira abertura da porta.
- `GET /access/door`: Consumo autenticado da fila de comandos.

---

### 3.3. Refatoração do Firmware ESP32 (Evolução de Server para Polling Client)

O firmware em [`esp32/door_lock.ino`](file:///c:/Users/Usuario/gridmart-api/esp32/door_lock.ino) foi reformulado:

1. **Substituição de Bibliotecas**:
   - Removido `<WebServer.h>`.
   - Incluído `<HTTPClient.h>`.
2. **Parâmetros Operacionais**:
   - `POLL_MS = 500`: Polling na API a cada meio segundo.
   - `OPEN_MS = 6000`: Duração da porta destravada (6 segundos).
3. **Mecanismo Anti-Batimento (Anti-Slam)**:
   - Se 2 ou mais pessoas entram no mesmo grupo e geram múltiplos comandos, o ESP32 consome os comandos mantendo o relé energizado por 6 segundos após a abertura inicial, evitando batimentos da porta física sobre os clientes.
4. **Header de Autenticação**:
   - Toda chamada HTTP GET injeta `http.addHeader("x-door-token", doorToken)`.

```cpp
// esp32/door_lock.ino
if (WiFi.status() == WL_CONNECTED && !doorOpen) {
  HTTPClient http;
  http.begin(apiUrl);
  http.addHeader("x-door-token", doorToken);

  int code = http.GET();
  if (code == 200) openDoor(); // 200 = comando de liberação recebido

  http.end();
}
```

---

### 3.4. Módulo de Vendas: Vínculo de Comprador e Abstração Pix (`/sales`)

Implementado em [`src/modules/sales/sales.routes.ts`](file:///c:/Users/Usuario/gridmart-api/src/modules/sales/sales.routes.ts):

1. **Validação de Comprador (`userId`)**:
   - O schema Zod passou a validar `userId: z.number().int().positive().optional()`.
   - Caso `userId` seja fornecido na requisição, a rota consulta a tabela `users`. Caso o usuário não seja encontrado, encerra a transação com `404 Not Found` (`{ "error": "Comprador não encontrado" }`).

2. **Validação e Snapshot de Itens**:
   - Para cada item da venda, o sistema consulta a tabela `products` para verificar se o produto existe e recuperar o preço oficial cadastrado no banco (`priceInCents`).
   - Evita que clientes ou totens adulterem o valor monetário na requisição.
   - Grava cada item em `sale_items` com seu `priceInCents` congelado no momento da compra.

3. **Abstração do Gerador Pix (`buildPix`)**:
   - Extraída a função `buildPix(totalInCents: number)`.
   - Gera o payload estático padrão EMV BR Code:
     ```typescript
     const buildPix = (totalInCents: number) =>
       `00020126580014br.gov.bcb.pix0136gridmart-${Date.now()}520400005303986540${(totalInCents / 100).toFixed(2)}5802BR5908GRIDMART6009SAOPAULO62070503***6304`;
     ```

4. **Endpoints do Módulo**:
   - `POST /sales`: Criação de pedido, cálculo de total, persistência dos itens e emissão Pix. Retorna status `201 Created`.
   - `GET /sales/:id`: Validação de ID com `idParam` e consulta de status (`200 OK` / `404 Not Found`).
   - `POST /sales/:id/pay`: Atualização do status para `PAID` (`200 OK` / `404 Not Found`).

---

### 3.5. Factory Genérica de CRUD Reutilizável (`crud.ts`)

Desenvolvido o utilitário [`src/utils/crud.ts`](file:///c:/Users/Usuario/gridmart-api/src/utils/crud.ts):

- **Objetivo**: Evitar repetição de código em tabelas que seguem operações CRUD padrão (Create, Read, Update, Delete).
- **Integração com Drizzle-Zod**:
  ```typescript
  export function crud(app: Hono<Env>, table: SQLiteTableWithColumns<any>) {
    const insertSchema = createInsertSchema(table).omit({ id: true });
    // Provisiona automaticamente GET /, GET /:id, POST /, PUT /:id, DELETE /:id
  }
  ```
- **Aplicação no Módulo de Produtos** ([`src/modules/products/products.routes.ts`](file:///c:/Users/Usuario/gridmart-api/src/modules/products/products.routes.ts)):
  - O arquivo foi reduzido para apenas **13 linhas**:
    ```typescript
    export const productRoutes = new Hono<Env>();

    crud(productRoutes, products);

    productRoutes.get("/barcode/:barcode", async (c) =>
      or404(c, await db(c).select().from(products).where(eq(products.barcode, c.req.param("barcode"))).get())
    );
    ```

---

### 3.6. Tratamento de Erros, Resiliência e Validações Globais

1. **Tratamento Específico de Conflitos no `errorHandler`** ([`src/middlewares/errorHandler.ts`](file:///c:/Users/Usuario/gridmart-api/src/middlewares/errorHandler.ts)):
   - Implementada a função recursiva `hasUniqueError(err)` que verifica se `err.message` ou `err.cause` contém a string `"UNIQUE constraint failed"`.
   - Em caso de violação de campo único (ex: CPF já cadastrado em `users` ou código de barras já existente em `products`), a API retorna **`409 Conflict`** com o JSON `{ "error": "Conflito: registro já existe" }`.
   - Erros inesperados retornam `500` com `{ "error": "Erro interno" }`, preservando a segurança da aplicação.

2. **Helpers Centralizados em `src/utils/api.ts`**:
   - `idParam(c)`: Garante que o parâmetro `:id` seja um número inteiro estritamente positivo, retornando `undefined` caso inválido.
   - `or404(c, item)`: Helper genérico tipado que retorna `c.json(item)` se o registro existir ou `404 Not Found` caso contrário.
   - `Env`: Definição central dos bindings do Cloudflare (`DB: D1Database`, `DOOR_TOKEN: string`).

3. **Validação Algorítmica de CPF** ([`src/utils/cpf.ts`](file:///c:/Users/Usuario/gridmart-api/src/utils/cpf.ts) e [`src/utils/cpf.test.ts`](file:///c:/Users/Usuario/gridmart-api/src/utils/cpf.test.ts)):
   - Validação dos dois dígitos verificadores (módulo 11 oficial da Receita Federal).
   - Rejeição de sequências com dígitos repetidos (`111.111.111-11`, etc.) e tamanhos incorretos.
   - Testado exaustivamente com Bun Test.

---

### 3.7. Higienização de Código e Remoção de Arquivos Obsoletos

No commit [`6602d86`](file:///c:/Users/Usuario/gridmart-api/):
- **Remoção de `src/middlewares/auto404.ts`**: O middleware de auto-404 foi substituído de maneira mais segura pelo helper explícito `or404()`, evitando efeitos colaterais em rotas que intencionalmente retornam `null`.
- **Remoção de arquivo de licença duplicado**: Limpeza de `src/gridmart-api/LICENSE`, mantendo apenas o arquivo de licença na raiz do repositório ([`LICENSE`](file:///c:/Users/Usuario/gridmart-api/LICENSE)).

---

## 4. Tabela Comparativa: Antes vs. Depois

| Aspecto | Estado Anterior | Estado Atual (Pós-Ciclo) |
| :--- | :--- | :--- |
| **Status dos Módulos** | `/access` e `/sales` descritos como "em desenvolvimento" | Módulos 100% implementados, testados e integrados com o banco de dados |
| **Comunicação com a Porta** | Tentativa de push para servidor Web no ESP32 na rede local | Fila assíncrona persistida (`door_commands`) consumida via polling seguro |
| **Autenticação IoT** | Nenhuma | Header `x-door-token` validado contra `DOOR_TOKEN` no Worker |
| **Auditoria de Acesso** | Tabela rudimentar | Logs completos com `type` (`ENTRY`/`EXIT`) e `status` (`GRANTED`/`DENIED`) |
| **Vínculo do Comprador** | Apenas vendas anônimas | Suporte a `userId` opcional com verificação de existência prévia no banco |
| **Snapshot de Preços** | Preço suscetível a alterações no catálogo | Preço unitário snapshot gravado em cada linha de `sale_items` |
| **Código do Módulo de Produtos** | Mais de 70 linhas repetitivas de CRUD | 13 linhas elegantes utilizando a factory genérica `crud.ts` |
| **Tratamento de Conflito (UNIQUE)** | Erro `500` interno exposto pelo SQLite | Erro HTTP `409 Conflict` limpo com mensagem descritiva |
| **Emissão de Pix** | String manual embutida | Função utilitária desacoplada `buildPix()` com valor e timestamp |

---

## 5. Impacto no Ecossistema Integrado (Frontend & IoT)

1. **Totem de Checkout ([`TotemCheckout.tsx`](file:///c:/Users/Usuario/gridmart--front-end/src/components/TotemCheckout.tsx))**:
   - Integração direta com `POST /sales` recebendo `pixQrCode` para renderização imediata de QR Code via canvas/SVG.
   - Suporte à finalização da venda via `POST /sales/:id/pay`.
2. **Controle de Acesso ([`AccessControl.tsx`](file:///c:/Users/Usuario/gridmart--front-end/src/components/AccessControl.tsx))**:
   - Chamadas instantâneas a `POST /access/check` (com alerta para usuários bloqueados via HTTP `403`).
   - Fluxo contínuo de cadastro via `POST /access/register` que destrava a porta automaticamente no retorno `201 Created`.
   - Botão de saída conectado a `POST /access/exit`.
3. **Hardware ESP32 ([`esp32/door_lock.ino`](file:///c:/Users/Usuario/gridmart-api/esp32/door_lock.ino))**:
   - Polling leve a cada 500ms, sem sobrecarga no microcontrolador, acionando o relé por 6 segundos com total resiliência a oscilações de rede.

---

## 6. Instruções de Execução, Testes e Verificação

### Dependências e Ferramentas:
- **Bun** (Recomendado para execução de testes e scripts)
- **Wrangler** (Emulador do Cloudflare Workers & D1 local)

### Comandos de Validação do Backend:

```bash
# 1. Execução da suíte de testes unitários
bun test

# 2. Verificação estática de tipos TypeScript
bun run typecheck

# 3. Geração de novas migrações D1 (caso o schema seja editado)
bun run db:generate

# 4. Aplicação de migrações no banco local SQLite/D1
bun run db:migrate

# 5. Início do servidor de desenvolvimento local
bun run dev
```

---

> Documento gerado como registro consolidado das implementações técnicas do ciclo de desenvolvimento da **GridMart API**.

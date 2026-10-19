import { and, desc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { accessLogs, sales, users, visits } from "../db/schema";
import type { DB } from "../utils/api";

const EXIT_TOKEN_TTL_MS = 25_000;
const normalize = (cpf: string) => cpf.replace(/\D/g, "");

export class AccessService {
  constructor(private db: DB) {}

  /** Só responde se o CPF já existe; usado para decidir se pede o nome. */
  async check(cpfRaw: string) {
    const cpf = normalize(cpfRaw);
    const user = await this.db.select().from(users).where(eq(users.cpf, cpf)).get();

    if (!user) return { registered: false, allowed: false };
    return { registered: true, allowed: !user.isBlocked, name: user.name };
  }

  /** Cadastro do primeiro acesso. */
  async register(cpfRaw: string, name: string) {
    const cpf = normalize(cpfRaw);
    const user = await this.db.insert(users).values({ cpf, name }).returning().get();
    return { registered: true, allowed: true, name: user.name, userId: user.id };
  }

  /** Marca a entrada: cria a visita (a pessoa passa a estar "dentro"). */
  async enter(cpfRaw: string) {
    const cpf = normalize(cpfRaw);
    const user = await this.db.select().from(users).where(eq(users.cpf, cpf)).get();

    if (!user) throw new HTTPException(404, { message: "Usuário não cadastrado" });
    if (user.isBlocked) {
      await this.log(cpf, "DENIED");
      throw new HTTPException(403, { message: "Acesso bloqueado" });
    }

    const openVisit = await this.db
      .select()
      .from(visits)
      .where(and(eq(visits.userId, user.id), eq(visits.status, "OPEN")))
      .get();
    if (openVisit) throw new HTTPException(409, { message: "Já existe uma visita aberta" });

    const visit = await this.db.insert(visits).values({ userId: user.id }).returning().get();
    await this.log(cpf, "GRANTED");

    return { visitId: visit.id, name: user.name };
  }

  /** Gera o token de uso único para a saída (só depois do pagamento confirmado). */
  async createExitToken(saleId: number | null) {
    if (!saleId) throw new HTTPException(404, { message: "Venda não encontrada" });

    const sale = await this.db.select().from(sales).where(eq(sales.id, saleId)).get();
    if (!sale) throw new HTTPException(404, { message: "Venda não encontrada" });
    if (sale.status !== "PAID") throw new HTTPException(409, { message: "Pagamento ainda não confirmado" });

    const visit = await this.db.select().from(visits).where(eq(visits.id, sale.visitId)).get();
    if (!visit || visit.status !== "OPEN") throw new HTTPException(409, { message: "Visita não está aberta" });

    const token = crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + EXIT_TOKEN_TTL_MS).toISOString();
    await this.db
      .update(visits)
      .set({ exitToken: token, exitTokenExpiresAt: expiresAt })
      .where(eq(visits.id, visit.id))
      .run();

    return { token, expiresAt };
  }

  /** Consome o token (uso único) e fecha a visita. */
  async exit(token: string) {
    const visit = await this.db.select().from(visits).where(eq(visits.exitToken, token)).get();
    if (!visit || visit.status !== "OPEN") throw new HTTPException(403, { message: "Token de saída inválido" });
    if (!visit.exitTokenExpiresAt || visit.exitTokenExpiresAt < new Date().toISOString())
      throw new HTTPException(410, { message: "Token de saída expirado" });

    const user = await this.db.select().from(users).where(eq(users.id, visit.userId)).get();
    await this.db
      .update(visits)
      .set({ status: "CLOSED", exitedAt: new Date().toISOString(), exitToken: null, exitTokenExpiresAt: null })
      .where(eq(visits.id, visit.id))
      .run();
    await this.log(user?.cpf ?? String(visit.userId), "GRANTED");

    return { visitId: visit.id };
  }

  private log(cpf: string, status: "GRANTED" | "DENIED") {
    return this.db.insert(accessLogs).values({ cpf, status }).run();
  }

  // ── Administração ──────────────────────────────────────────────────────

  /** Lista visitas; `status` filtra por OPEN/CLOSED (default: todas). */
  async listVisits(status?: string) {
    const query = this.db
      .select({
        id: visits.id,
        userId: users.id,
        userCpf: users.cpf,
        userName: users.name,
        status: visits.status,
        enteredAt: visits.enteredAt,
        exitedAt: visits.exitedAt,
      })
      .from(visits)
      .innerJoin(users, eq(visits.userId, users.id))
      .$dynamic();

    return (status ? query.where(eq(visits.status, status)) : query).all();
  }

  /** Fecha uma visita manualmente (ex.: cliente saiu pela botoeira). */
  async closeVisit(id: number | null) {
    if (!id) throw new HTTPException(404, { message: "Visita não encontrada" });

    const visit = await this.db.select().from(visits).where(eq(visits.id, id)).get();
    if (!visit) throw new HTTPException(404, { message: "Visita não encontrada" });
    if (visit.status === "CLOSED") return { visitId: visit.id, status: visit.status };

    await this.db
      .update(visits)
      .set({ status: "CLOSED", exitedAt: new Date().toISOString(), exitToken: null, exitTokenExpiresAt: null })
      .where(eq(visits.id, visit.id))
      .run();

    return { visitId: visit.id, status: "CLOSED" };
  }

  /** Bloqueia/desbloqueia um cliente. */
  async setBlocked(id: number | null, isBlocked: boolean) {
    if (!id) throw new HTTPException(404, { message: "Usuário não encontrado" });

    const user = await this.db
      .update(users)
      .set({ isBlocked })
      .where(eq(users.id, id))
      .returning({ id: users.id, name: users.name, isBlocked: users.isBlocked })
      .get();
    if (!user) throw new HTTPException(404, { message: "Usuário não encontrado" });

    return user;
  }

  /** Lista usuários cadastrados. */
  async listUsers() {
    return this.db
      .select({
        id: users.id,
        cpf: users.cpf,
        name: users.name,
        isBlocked: users.isBlocked,
        createdAt: users.createdAt,
      })
      .from(users)
      .all();
  }

  /** Auditoria de acessos, mais recentes primeiro. */
  async listAccessLogs(limit = 100) {
    return this.db
      .select({
        id: accessLogs.id,
        cpf: accessLogs.cpf,
        status: accessLogs.status,
        createdAt: accessLogs.createdAt,
      })
      .from(accessLogs)
      .orderBy(desc(accessLogs.id))
      .limit(limit)
      .all();
  }
}

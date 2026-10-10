import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { accessLogs, sales, users, visits } from "../../db/schema";
import type { DB } from "../../utils/api";
import type { DoorGateway } from "../../adapters/door";

const EXIT_TOKEN_TTL_MS = 25_000;
const normalize = (cpf: string) => cpf.replace(/\D/g, "");

export class AccessService {
  constructor(
    private db: DB,
    private door: DoorGateway,
  ) {}

  /** Só responde se o CPF já existe; usado para decidir se pede o nome. */
  async check(cpfRaw: string) {
    const cpf = normalize(cpfRaw);
    const user = await this.db.select().from(users).where(eq(users.cpf, cpf)).get();

    if (!user) return { registered: false, allowed: false };
    return { registered: true, allowed: !user.isBlocked, name: user.name };
  }

  /** Cadastro rápido do primeiro acesso (não abre a porta). */
  async register(cpfRaw: string, name: string) {
    const cpf = normalize(cpfRaw);
    const user = await this.db.insert(users).values({ cpf, name }).returning().get();
    return { registered: true, allowed: true, name: user.name };
  }

  /** Abre a porta de entrada e cria a visita (a pessoa passa a estar "dentro"). */
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
    const command = await this.door.requestOpen("ENTRY", visit.id);

    return { visitId: visit.id, name: user.name, door: command };
  }

  /** Gera o token de uso único para a saída (só depois do pagamento confirmado). */
  async createExitToken(saleId: number) {
    const sale = await this.db.select().from(sales).where(eq(sales.id, saleId)).get();
    if (!sale) throw new HTTPException(404, { message: "Venda não encontrada" });
    if (sale.status !== "PAID") throw new HTTPException(409, { message: "Pagamento ainda não confirmado" });

    const visit = await this.db.select().from(visits).where(eq(visits.id, sale.visitId)).get();
    if (!visit || visit.status !== "OPEN") throw new HTTPException(409, { message: "Visita não está aberta" });

    const token = crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + EXIT_TOKEN_TTL_MS).toISOString();
    await this.db.update(visits).set({ exitToken: token, exitTokenExpiresAt: expiresAt }).where(eq(visits.id, visit.id)).run();

    return { token, expiresAt };
  }

  /** Consome o token (uso único), fecha a visita e abre a porta de saída. */
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
    const command = await this.door.requestOpen("EXIT", visit.id);

    return { visitId: visit.id, door: command };
  }

  private log(cpf: string, status: "GRANTED" | "DENIED") {
    return this.db.insert(accessLogs).values({ cpf, status }).run();
  }
}

import { eq } from "drizzle-orm";
import { doorCommands } from "../db/schema";
import type { DB } from "../utils/api";

export type DoorKind = "ENTRY" | "EXIT";

const OPEN_TTL_MS = 10_000; // tempo que o comando fica válido na fila

/**
 * Porta de saída para o hardware da porta.
 * No MVP a implementação grava comandos no D1 (fila) e o "ESP32"
 * consome via GET /devices/commands. Trocar por outra ponte depois
 * não exige mudar o resto do domínio.
 */
export interface DoorGateway {
  requestOpen(kind: DoorKind, visitId: number): Promise<DoorCommand>;
  pending(): Promise<DoorCommand[]>;
  ack(id: number): Promise<DoorCommand | undefined>;
}

export type DoorCommand = typeof doorCommands.$inferSelect;

export class D1DoorGateway implements DoorGateway {
  constructor(private db: DB) {}

  async requestOpen(kind: DoorKind, visitId: number): Promise<DoorCommand> {
    const expiresAt = new Date(Date.now() + OPEN_TTL_MS).toISOString();
    return this.db.insert(doorCommands).values({ kind, visitId, expiresAt }).returning().get();
  }

  async pending(): Promise<DoorCommand[]> {
    return this.db.select().from(doorCommands).where(eq(doorCommands.status, "PENDING")).all();
  }

  async ack(id: number): Promise<DoorCommand | undefined> {
    return this.db
      .update(doorCommands)
      .set({ status: "DONE", executedAt: new Date().toISOString() })
      .where(eq(doorCommands.id, id))
      .returning()
      .get();
  }
}

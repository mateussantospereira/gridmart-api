import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { devices } from "../../db/schema";
import type { DB } from "../../utils/api";

export class DeviceService {
  constructor(private db: DB) {}

  /** Autentica um dispositivo (porta/totem) pelo token enviado no header. */
  async authenticate(token?: string) {
    if (!token) throw new HTTPException(401, { message: "Token do dispositivo ausente" });

    const device = await this.db.select().from(devices).where(eq(devices.token, token)).get();
    if (!device) throw new HTTPException(403, { message: "Dispositivo inválido" });

    return device;
  }
}

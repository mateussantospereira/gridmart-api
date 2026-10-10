export interface PixCharge {
  txid: string;
  qrCode: string;
  expiresAt: string;
}

export interface PixChargeInput {
  saleId: number;
  totalInCents: number;
}

/**
 * Porta de saída para o provedor de Pix.
 * No MVP usamos um fake que gera um "copia e cola" qualquer.
 * Na fase de pagamento real, trocamos por Mercado Pago / Woovi / Efí etc.
 */
export interface PixGateway {
  createCharge(input: PixChargeInput): Promise<PixCharge>;
  parseWebhook(payload: unknown): { txid: string; paid: boolean } | null;
}

const CHARGE_TTL_MS = 5 * 60_000;

export class FakePixGateway implements PixGateway {
  async createCharge({ saleId, totalInCents }: PixChargeInput): Promise<PixCharge> {
    const txid = `GRIDMART${saleId}${Date.now()}`;
    const amount = (totalInCents / 100).toFixed(2);
    const qrCode = `00020126580014br.gov.bcb.pix0136gridmart-${txid}520400005303986540${amount}5802BR5908GRIDMART6009SAOPAULO62070503***6304`;

    return { txid, qrCode, expiresAt: new Date(Date.now() + CHARGE_TTL_MS).toISOString() };
  }

  parseWebhook(payload: unknown): { txid: string; paid: boolean } | null {
    const body = payload as { txid?: unknown; paid?: unknown };
    if (typeof body?.txid !== "string") return null;
    return { txid: body.txid, paid: body.paid !== false };
  }
}

import { and, eq, gte, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { profiles, creditLedger } from "@/lib/db/schema";

/**
 * Crédito do usuário. Sem transações interativas (o driver neon-http não as
 * suporta) — usamos SQL atômico:
 *  - crédito: incremento atômico + registro no ledger (idempotente por refId)
 *  - débito: update condicional (só desconta se houver saldo) + ledger
 */

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Saldo de créditos insuficiente.");
    this.name = "InsufficientCreditsError";
  }
}

export async function getBalance(userId: string): Promise<number> {
  const rows = await db
    .select({ balance: profiles.creditsBalance })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return rows[0]?.balance ?? 0;
}

/**
 * Credita `delta` (positivo). Se `refId` for informado e já houver um
 * lançamento com esse refId, não faz nada (idempotência p/ webhooks).
 */
export async function addCredits(
  userId: string,
  delta: number,
  reason: string,
  refId?: string
): Promise<void> {
  if (delta <= 0) return;

  if (refId) {
    const existing = await db
      .select({ id: creditLedger.id })
      .from(creditLedger)
      .where(eq(creditLedger.refId, refId))
      .limit(1);
    if (existing.length) return; // já processado
  }

  await db.insert(creditLedger).values({ userId, delta, reason, refId });
  await db
    .update(profiles)
    .set({ creditsBalance: sql`${profiles.creditsBalance} + ${delta}` })
    .where(eq(profiles.id, userId));
}

/**
 * Debita `amount` (positivo) somente se houver saldo. Lança
 * InsufficientCreditsError caso contrário.
 */
export async function debitCredits(
  userId: string,
  amount: number,
  reason: string,
  refId?: string
): Promise<void> {
  if (amount <= 0) return;

  const updated = await db
    .update(profiles)
    .set({ creditsBalance: sql`${profiles.creditsBalance} - ${amount}` })
    .where(and(eq(profiles.id, userId), gte(profiles.creditsBalance, amount)))
    .returning({ balance: profiles.creditsBalance });

  if (!updated.length) throw new InsufficientCreditsError();

  await db
    .insert(creditLedger)
    .values({ userId, delta: -amount, reason, refId });
}

/**
 * Converte uso de IA em créditos. Fatores ajustáveis por env (sem deploy).
 */
export function creditsForUsage({
  tokensIn = 0,
  tokensOut = 0,
  images = 0,
}: {
  tokensIn?: number;
  tokensOut?: number;
  images?: number;
}): number {
  const perInput = Number(process.env.CREDITS_PER_1K_INPUT_TOKENS ?? 1);
  const perOutput = Number(process.env.CREDITS_PER_1K_OUTPUT_TOKENS ?? 5);
  const perImage = Number(process.env.CREDITS_PER_IMAGE ?? 20);
  return Math.ceil(
    (tokensIn / 1000) * perInput +
      (tokensOut / 1000) * perOutput +
      images * perImage
  );
}

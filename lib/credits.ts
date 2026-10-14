import { and, eq, gte, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { profiles, creditLedger } from "@/lib/db/schema";

/**
 * Crédito do usuário. Sem transações interativas (o driver neon-http não as
 * suporta) — usamos SQL atômico:
 *  - compra: um INSERT … ON CONFLICT no ledger + upsert do saldo (CTE)
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
 * Credita uma compra do Stripe. Um único comando SQL: o INSERT no ledger
 * esbarra no índice único parcial (ref_id, reason = 'compra') e, se a sessão
 * já foi creditada, nada acontece — nem o saldo muda. Seguro contra reenvios
 * e entregas paralelas do mesmo evento.
 *
 * Retorna true se creditou agora, false se era duplicata.
 */
export async function addPurchaseCredits(
  userId: string,
  credits: number,
  checkoutSessionId: string
): Promise<boolean> {
  if (!Number.isInteger(credits) || credits <= 0) {
    throw new Error(`Créditos inválidos: ${credits}`);
  }

  const result = await db.execute<{ id: string }>(sql`
    WITH ins AS (
      INSERT INTO credit_ledger (user_id, delta, reason, ref_id)
      VALUES (${userId}, ${credits}, 'compra', ${checkoutSessionId})
      ON CONFLICT (ref_id) WHERE reason = 'compra' DO NOTHING
      RETURNING user_id, delta
    )
    INSERT INTO profiles (id, credits_balance)
    SELECT user_id, delta FROM ins
    ON CONFLICT (id) DO UPDATE
      SET credits_balance = profiles.credits_balance + EXCLUDED.credits_balance
    RETURNING id
  `);

  return result.rows.length > 0;
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

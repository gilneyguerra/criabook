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

/* ============================================================
 * Reserva → acerto/estorno (S1)
 *
 * Toda entrada de IA reserva a estimativa ANTES de chamar o provedor e, no
 * fim, acerta pelo consumo real ou estorna tudo em caso de falha. Cada passo
 * é um único comando SQL (neon-http não tem transação interativa), e os três
 * lançamentos compartilham o mesmo refId no ledger.
 * ============================================================ */

export type Reservation = {
  userId: string;
  refId: string;
  op: string;
  amount: number;
};

/**
 * Debita `amount` do saldo como reserva. Lança InsufficientCreditsError se
 * não houver saldo — o UPDATE condicional é o que impede requisições
 * paralelas de passarem todas pela checagem.
 */
export async function reserveCredits(
  userId: string,
  op: string,
  amount: number
): Promise<Reservation & { balance: number }> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`Reserva inválida: ${amount}`);
  }
  const refId = crypto.randomUUID();

  const result = await db.execute<{ balance: number }>(sql`
    WITH upd AS (
      UPDATE profiles
      SET credits_balance = credits_balance - ${amount}::int
      WHERE id = ${userId} AND credits_balance >= ${amount}::int
      RETURNING id, credits_balance
    ), led AS (
      INSERT INTO credit_ledger (user_id, delta, reason, ref_id, op)
      SELECT id, -(${amount}::int), 'reserva', ${refId}, ${op} FROM upd
    )
    SELECT credits_balance AS balance FROM upd
  `);

  const row = result.rows[0];
  if (!row) throw new InsufficientCreditsError();
  return { userId, refId, op, amount, balance: Number(row.balance) };
}

type CloseResult = {
  /** false se a reserva já tinha sido fechada (acerto/estorno repetido). */
  applied: boolean;
  /** Variação aplicada ao saldo neste fechamento. */
  delta: number;
  balance: number | null;
};

/**
 * Fecha a reserva. `diff` = custo real − reservado:
 *  - diff ≤ 0 devolve a sobra (−diff);
 *  - diff > 0 debita o excedente, limitado ao saldo (nunca fica negativo).
 * O índice único (ref_id) WHERE reason IN ('acerto','estorno') garante um
 * único fechamento por reserva, mesmo com chamadas repetidas ou paralelas.
 */
async function closeReservation(
  res: Reservation,
  reason: "acerto" | "estorno",
  diff: number
): Promise<CloseResult> {
  const result = await db.execute<{ delta: number; balance: number | null }>(sql`
    WITH p AS (
      SELECT credits_balance FROM profiles WHERE id = ${res.userId} FOR UPDATE
    ), ins AS (
      INSERT INTO credit_ledger (user_id, delta, reason, ref_id, op)
      SELECT ${res.userId},
             CASE WHEN ${diff}::int <= 0 THEN -(${diff}::int)
                  ELSE -LEAST(p.credits_balance, ${diff}::int) END,
             ${reason}, ${res.refId}, ${res.op}
      FROM p
      ON CONFLICT (ref_id) WHERE reason IN ('acerto', 'estorno') DO NOTHING
      RETURNING delta
    ), upd AS (
      UPDATE profiles SET credits_balance = profiles.credits_balance + ins.delta
      FROM ins WHERE profiles.id = ${res.userId}
      RETURNING profiles.credits_balance
    )
    SELECT ins.delta, upd.credits_balance AS balance FROM ins LEFT JOIN upd ON true
  `);

  const row = result.rows[0];
  if (!row) return { applied: false, delta: 0, balance: null };
  return {
    applied: true,
    delta: Number(row.delta),
    balance: row.balance === null ? null : Number(row.balance),
  };
}

/** Acerta a reserva pelo custo real. Excedente sem saldo vai para o log. */
export async function settleCredits(
  res: Reservation,
  actualCost: number
): Promise<CloseResult> {
  const diff = Math.ceil(actualCost) - res.amount;
  const out = await closeReservation(res, "acerto", diff);
  if (out.applied && diff > 0 && -out.delta < diff) {
    console.warn("[credits] custo real acima do reservado sem saldo", {
      refId: res.refId,
      op: res.op,
      reserved: res.amount,
      actual: Math.ceil(actualCost),
      uncovered: diff + out.delta,
    });
  }
  return out;
}

/** Estorna a reserva inteira (falha da IA ou da operação). */
export async function refundCredits(res: Reservation): Promise<CloseResult> {
  return closeReservation(res, "estorno", -res.amount);
}

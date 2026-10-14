import { sql } from "drizzle-orm";

import { db } from "@/lib/db";

/**
 * Rate limit das entradas de IA por usuário, em Postgres (janela fixa).
 * Um único INSERT … ON CONFLICT DO UPDATE incrementa as duas janelas
 * (minuto e dia) e devolve as contagens; atômico mesmo com chamadas
 * paralelas. Tentativas recusadas também contam.
 */

export class RateLimitError extends Error {
  constructor(public readonly bucket: "minute" | "day") {
    super(
      bucket === "minute"
        ? "Muitas requisições de IA em pouco tempo."
        : "Limite diário de requisições de IA atingido."
    );
    this.name = "RateLimitError";
  }
}

export function aiRateLimits() {
  return {
    perMinute: Number(process.env.AI_RATE_PER_MINUTE ?? 20),
    perDay: Number(process.env.AI_RATE_PER_DAY ?? 300),
  };
}

/** Conta uma requisição de IA do usuário; lança RateLimitError se passar. */
export async function checkAiRateLimit(
  userId: string,
  limits = aiRateLimits()
): Promise<void> {
  const result = await db.execute<{ bucket: string; count: number }>(sql`
    INSERT INTO ai_rate_limits (user_id, bucket, window_start, count)
    VALUES
      (${userId}, 'minute', date_trunc('minute', now()), 1),
      (${userId}, 'day', date_trunc('day', now()), 1)
    ON CONFLICT (user_id, bucket) DO UPDATE SET
      count = CASE
        WHEN ai_rate_limits.window_start = EXCLUDED.window_start
          THEN ai_rate_limits.count + 1
        ELSE 1
      END,
      window_start = EXCLUDED.window_start
    RETURNING bucket, count
  `);

  for (const row of result.rows) {
    const count = Number(row.count);
    if (row.bucket === "minute" && count > limits.perMinute) {
      throw new RateLimitError("minute");
    }
    if (row.bucket === "day" && count > limits.perDay) {
      throw new RateLimitError("day");
    }
  }
}

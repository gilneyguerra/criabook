import { NextResponse } from "next/server";

import { MODEL_FAST } from "@/lib/ai/claude";
import {
  Meter,
  estimateCredits,
  runWithMeter,
  type AiOp,
} from "@/lib/ai/metering";
import {
  InsufficientCreditsError,
  refundCredits,
  reserveCredits,
  settleCredits,
  type Reservation,
} from "@/lib/credits";

export type MeteredOp = {
  reservation: Reservation;
  /** Saldo logo após a reserva. */
  balanceAfterReserve: number;
  meter: Meter;
  /** Roda `fn` medindo as chamadas de IA feitas dentro dela. */
  run<T>(fn: () => Promise<T>): Promise<T>;
  /** Acerta pelo consumo medido. Idempotente. Retorna o custo cobrado. */
  settle(): Promise<{ charged: number; balance: number | null }>;
  /** Estorna a reserva inteira. Idempotente. */
  refund(): Promise<void>;
};

/**
 * Reserva a estimativa da operação e devolve os controles para acertar ou
 * estornar depois. Usado pelas rotas com SSE, em que a resposta sai antes
 * do fim do trabalho: reservar antes de abrir o stream, fechar num finally.
 *
 * Lança InsufficientCreditsError se não houver saldo para a reserva.
 */
export async function startMetered(
  userId: string,
  op: AiOp
): Promise<MeteredOp> {
  const reserved = await reserveCredits(userId, op, estimateCredits(op));
  const { balance, ...reservation } = reserved;
  const meter = new Meter(MODEL_FAST);
  let closed = false;

  return {
    reservation,
    balanceAfterReserve: balance,
    meter,
    run: (fn) => runWithMeter(meter, fn),
    async settle() {
      const charged = meter.credits();
      if (closed) return { charged, balance: null };
      closed = true;
      const out = await settleCredits(reservation, charged);
      return {
        charged: out.applied ? reservation.amount - out.delta : charged,
        balance: out.balance,
      };
    },
    async refund() {
      if (closed) return;
      closed = true;
      try {
        await refundCredits(reservation);
      } catch (err) {
        console.error("[credits] falha ao estornar reserva", {
          refId: reservation.refId,
          op,
          err,
        });
      }
    },
  };
}

/**
 * Executa uma operação de IA com créditos: reserva → executa → acerta pelo
 * consumo real. Qualquer exceção estorna a reserva inteira e é relançada.
 */
export async function withCredits<T>(
  userId: string,
  op: AiOp,
  fn: (meter: Meter) => Promise<T>
): Promise<T> {
  const m = await startMetered(userId, op);
  let result: T;
  try {
    result = await m.run(() => fn(m.meter));
  } catch (err) {
    await m.refund();
    throw err;
  }
  await m.settle();
  return result;
}

/** Mensagem padrão para saldo insuficiente (402). */
export const NO_CREDITS_MESSAGE =
  "Créditos insuficientes. Compre mais em /dashboard/creditos.";

/** Converte InsufficientCreditsError em resposta 402; outros erros: null. */
export function creditErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof InsufficientCreditsError) {
    return NextResponse.json({ error: NO_CREDITS_MESSAGE }, { status: 402 });
  }
  return null;
}

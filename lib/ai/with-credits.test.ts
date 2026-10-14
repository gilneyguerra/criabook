import { EventEmitter } from "node:events";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { MODEL_FAST } from "@/lib/ai/claude";
import {
  Meter,
  currentMeter,
  estimateCredits,
  instrumentAnthropic,
  runWithMeter,
} from "@/lib/ai/metering";
import { startMetered, withCredits } from "@/lib/ai/with-credits";
import {
  InsufficientCreditsError,
  getBalance,
  refundCredits,
  reserveCredits,
  settleCredits,
} from "@/lib/credits";
import { db } from "@/lib/db";
import { creditLedger } from "@/lib/db/schema";
import { createTestUser, deleteTestUser, hasTestDb } from "@/lib/test/db";

const MAIN = "claude-sonnet-test";
const CHAPTER = estimateCredits("chapter");

describe("metering (sem banco)", () => {
  it("custo mínimo de 1 crédito", () => {
    expect(new Meter(MODEL_FAST).credits()).toBe(1);
    expect(estimateCredits("suggest")).toBeGreaterThanOrEqual(1);
  });

  it("estimativa do capítulo considera o contexto ancorado (~8k de entrada)", () => {
    const m = new Meter(MODEL_FAST);
    m.recordTokens(MAIN, { input_tokens: 1500, output_tokens: 3500 });
    expect(CHAPTER).toBeGreaterThan(m.credits());
  });

  it("Haiku custa menos que o modelo principal pelos mesmos tokens", () => {
    const main = new Meter(MODEL_FAST);
    main.recordTokens(MAIN, { input_tokens: 10000, output_tokens: 10000 });
    const fast = new Meter(MODEL_FAST);
    fast.recordTokens(MODEL_FAST, { input_tokens: 10000, output_tokens: 10000 });
    expect(fast.credits()).toBeLessThan(main.credits());
  });

  it("client instrumentado registra create e stream no meter do contexto", async () => {
    const usage = { input_tokens: 2000, output_tokens: 1000 };
    const fake = {
      messages: {
        create: async (body: { model: string }) => ({ usage, model: body.model }),
        stream: (body: { model: string }) => {
          const s = new EventEmitter();
          setTimeout(() => s.emit("finalMessage", { usage, model: body.model }), 5);
          return s;
        },
      },
    };
    const client = instrumentAnthropic(fake);
    const meter = new Meter(MODEL_FAST);

    await runWithMeter(meter, async () => {
      await client.messages.create({ model: MAIN });
      await new Promise<void>((resolve) => {
        client.messages.stream({ model: MODEL_FAST }).on("finalMessage", () => resolve());
      });
    });
    // Fora do contexto: não registra em lugar nenhum.
    await client.messages.create({ model: MAIN });

    expect(meter.snapshot()).toMatchObject({
      mainIn: 2000,
      mainOut: 1000,
      fastIn: 2000,
      fastOut: 1000,
      calls: 2,
    });
    expect(currentMeter()).toBeUndefined();
  });
});

const created: string[] = [];
async function user(credits: number) {
  const u = await createTestUser({ credits });
  created.push(u.id);
  return u.id;
}

describe.skipIf(!hasTestDb)("reserva e acerto de créditos (banco de teste)", () => {
  afterAll(async () => {
    await Promise.all(created.map(deleteTestUser));
  });

  it("saldo para 1 geração e 5 requisições paralelas: só 1 passa", async () => {
    const id = await user(CHAPTER);
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        withCredits(id, "chapter", async (meter) => {
          await new Promise((r) => setTimeout(r, 50));
          meter.recordTokens(MAIN, { input_tokens: 1000, output_tokens: 1000 });
          return "ok";
        })
      )
    );

    const ok = results.filter((r) => r.status === "fulfilled");
    const denied = results.filter(
      (r) => r.status === "rejected" && r.reason instanceof InsufficientCreditsError
    );
    expect(ok).toHaveLength(1);
    expect(denied).toHaveLength(4);
    expect(await getBalance(id)).toBeGreaterThanOrEqual(0);
  });

  it("IA que falha: saldo volta ao valor inicial", async () => {
    const id = await user(500);
    await expect(
      withCredits(id, "chapter", async () => {
        throw new Error("provedor fora do ar");
      })
    ).rejects.toThrow("provedor fora do ar");
    expect(await getBalance(id)).toBe(500);
  });

  it("conta com 0 crédito: reserva recusada", async () => {
    const id = await user(0);
    await expect(startMetered(id, "suggest")).rejects.toBeInstanceOf(
      InsufficientCreditsError
    );
  });

  it("acerta pelo consumo real e devolve a sobra", async () => {
    const id = await user(500);
    await withCredits(id, "chapter", async (meter) => {
      meter.recordTokens(MAIN, { input_tokens: 4000, output_tokens: 2000 });
    });
    // 4 (entrada) + 10 (saída) = 14 créditos.
    expect(await getBalance(id)).toBe(500 - 14);

    const rows = await db
      .select()
      .from(creditLedger)
      .where(eq(creditLedger.userId, id));
    expect(rows.map((r) => r.reason).sort()).toEqual(["acerto", "reserva"]);
    expect(new Set(rows.map((r) => r.refId)).size).toBe(1);
    expect(rows.every((r) => r.op === "chapter")).toBe(true);
  });

  it("custo acima do reservado: debita o excedente, sem saldo negativo", async () => {
    const id = await user(CHAPTER + 3);
    const res = await reserveCredits(id, "chapter", CHAPTER);
    const out = await settleCredits(res, CHAPTER + 100);
    expect(out.delta).toBe(-3);
    expect(await getBalance(id)).toBe(0);
  });

  it("fechamento é único: acerto e estorno repetidos não somam", async () => {
    const id = await user(100);
    const res = await reserveCredits(id, "suggest", 10);
    const outs = await Promise.all([
      settleCredits(res, 2),
      settleCredits(res, 2),
      refundCredits(res),
      refundCredits(res),
    ]);
    expect(outs.filter((o) => o.applied)).toHaveLength(1);

    const closes = await db
      .select()
      .from(creditLedger)
      .where(and(eq(creditLedger.userId, id), eq(creditLedger.refId, res.refId)));
    expect(closes.filter((r) => r.reason !== "reserva")).toHaveLength(1);
    const balance = await getBalance(id);
    expect([98, 100]).toContain(balance);
  });
});

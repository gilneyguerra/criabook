import { afterAll, describe, expect, it } from "vitest";

import { startMetered } from "@/lib/ai/with-credits";
import { RateLimitError, checkAiRateLimit } from "@/lib/ratelimit";
import { createTestUser, deleteTestUser, hasTestDb } from "@/lib/test/db";

const created: string[] = [];
async function user(credits = 1000) {
  const u = await createTestUser({ credits });
  created.push(u.id);
  return u.id;
}

describe.skipIf(!hasTestDb)("rate limit de IA (banco de teste)", () => {
  afterAll(async () => {
    await Promise.all(created.map(deleteTestUser));
  });

  it("21ª chamada de IA no mesmo minuto é recusada", async () => {
    const id = await user();
    for (let i = 0; i < 20; i++) await checkAiRateLimit(id);
    await expect(startMetered(id, "suggest")).rejects.toBeInstanceOf(RateLimitError);
  });

  it("chamadas paralelas não furam o limite", async () => {
    const id = await user();
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        checkAiRateLimit(id, { perMinute: 5, perDay: 1000 })
      )
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
  });

  it("limite diário vale mesmo abaixo do limite por minuto", async () => {
    const id = await user();
    const limits = { perMinute: 1000, perDay: 2 };
    await checkAiRateLimit(id, limits);
    await checkAiRateLimit(id, limits);
    const err = await checkAiRateLimit(id, limits).catch((e) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.bucket).toBe("day");
  });

  it("usuários diferentes têm contadores separados", async () => {
    const a = await user();
    const b = await user();
    const limits = { perMinute: 1, perDay: 1000 };
    await checkAiRateLimit(a, limits);
    await expect(checkAiRateLimit(b, limits)).resolves.toBeUndefined();
  });
});

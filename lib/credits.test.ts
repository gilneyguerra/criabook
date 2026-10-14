import { afterAll, describe, expect, it } from "vitest";

import { InsufficientCreditsError, getBalance, reserveCredits } from "./credits";
import { createTestUser, deleteTestUser, hasTestDb } from "@/lib/test/db";

const created: string[] = [];

describe.skipIf(!hasTestDb)("créditos (banco de teste)", () => {
  afterAll(async () => {
    await Promise.all(created.map(deleteTestUser));
  });

  it("reserva quando há saldo e recusa quando não há", async () => {
    const u = await createTestUser({ credits: 5 });
    created.push(u.id);

    await reserveCredits(u.id, "suggest", 3);
    expect(await getBalance(u.id)).toBe(2);

    await expect(reserveCredits(u.id, "suggest", 5)).rejects.toBeInstanceOf(
      InsufficientCreditsError
    );
    expect(await getBalance(u.id)).toBe(2);
  });
});

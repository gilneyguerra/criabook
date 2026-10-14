import { afterAll, describe, expect, it } from "vitest";

import { InsufficientCreditsError, debitCredits, getBalance } from "./credits";
import { createTestUser, deleteTestUser, hasTestDb } from "@/lib/test/db";

const created: string[] = [];

describe.skipIf(!hasTestDb)("créditos (banco de teste)", () => {
  afterAll(async () => {
    await Promise.all(created.map(deleteTestUser));
  });

  it("debita quando há saldo e recusa quando não há", async () => {
    const u = await createTestUser({ credits: 5 });
    created.push(u.id);

    await debitCredits(u.id, 3, "teste");
    expect(await getBalance(u.id)).toBe(2);

    await expect(debitCredits(u.id, 5, "teste")).rejects.toBeInstanceOf(
      InsufficientCreditsError
    );
    expect(await getBalance(u.id)).toBe(2);
  });
});

import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";
import { afterAll, describe, expect, it } from "vitest";

import { getBalance } from "@/lib/credits";
import { db } from "@/lib/db";
import { creditLedger } from "@/lib/db/schema";
import { getPackage } from "@/lib/stripe/packages";
import { handleStripeEvent } from "@/lib/stripe/webhook";
import { createTestUser, deleteTestUser, hasTestDb } from "@/lib/test/db";

const created: string[] = [];
const START = getPackage("start")!;

async function newUser() {
  const u = await createTestUser({ credits: 0 });
  created.push(u.id);
  return u;
}

function event(
  type: string,
  session: Partial<Stripe.Checkout.Session>
): Stripe.Event {
  return {
    id: `evt_${randomUUID()}`,
    type,
    data: {
      object: {
        id: `cs_test_${randomUUID()}`,
        payment_status: "paid",
        amount_total: START.priceCents,
        ...session,
      },
    },
  } as unknown as Stripe.Event;
}

async function purchaseRows(userId: string) {
  return db
    .select()
    .from(creditLedger)
    .where(and(eq(creditLedger.userId, userId), eq(creditLedger.reason, "compra")));
}

describe.skipIf(!hasTestDb)("webhook do Stripe (banco de teste)", () => {
  afterAll(async () => {
    await Promise.all(created.map(deleteTestUser));
  });

  it("mesmo evento entregue 3x em paralelo credita uma única vez", async () => {
    const u = await newUser();
    const ev = event("checkout.session.completed", {
      metadata: { userId: u.id, packageId: START.id },
    });

    const outcomes = await Promise.all([
      handleStripeEvent(ev),
      handleStripeEvent(ev),
      handleStripeEvent(ev),
    ]);

    expect(outcomes.filter((o) => o === "credited")).toHaveLength(1);
    expect(outcomes.filter((o) => o === "duplicate")).toHaveLength(2);
    expect(await purchaseRows(u.id)).toHaveLength(1);
    expect(await getBalance(u.id)).toBe(START.credits);
  });

  it("sessão unpaid (boleto/PIX) não credita até o pagamento confirmado", async () => {
    const u = await newUser();
    const sessionId = `cs_test_${randomUUID()}`;
    const metadata = { userId: u.id, packageId: START.id };

    const pending = await handleStripeEvent(
      event("checkout.session.completed", {
        id: sessionId,
        payment_status: "unpaid",
        metadata,
      })
    );
    expect(pending).toBe("awaiting_payment");
    expect(await getBalance(u.id)).toBe(0);

    const paid = await handleStripeEvent(
      event("checkout.session.async_payment_succeeded", {
        id: sessionId,
        metadata,
      })
    );
    expect(paid).toBe("credited");
    expect(await getBalance(u.id)).toBe(START.credits);
  });

  it("pagamento assíncrono falho não credita", async () => {
    const u = await newUser();
    const outcome = await handleStripeEvent(
      event("checkout.session.async_payment_failed", {
        payment_status: "unpaid",
        metadata: { userId: u.id, packageId: START.id },
      })
    );
    expect(outcome).toBe("payment_failed");
    expect(await getBalance(u.id)).toBe(0);
  });

  it("créditos vêm do pacote, não de metadata.credits", async () => {
    const u = await newUser();
    await handleStripeEvent(
      event("checkout.session.completed", {
        metadata: { userId: u.id, packageId: START.id, credits: "999999" },
      })
    );
    expect(await getBalance(u.id)).toBe(START.credits);
  });

  it("pacote desconhecido não credita", async () => {
    const u = await newUser();
    const outcome = await handleStripeEvent(
      event("checkout.session.completed", {
        metadata: { userId: u.id, packageId: "inexistente" },
      })
    );
    expect(outcome).toBe("invalid_metadata");
    expect(await getBalance(u.id)).toBe(0);
  });
});

import type Stripe from "stripe";

import { addPurchaseCredits } from "@/lib/credits";
import { getPackage } from "@/lib/stripe/packages";

export type WebhookOutcome =
  | "credited"
  | "duplicate"
  | "awaiting_payment"
  | "payment_failed"
  | "invalid_metadata"
  | "ignored";

/**
 * Processa um evento já verificado do Stripe.
 *
 * - checkout.session.completed: credita só se payment_status === "paid"
 *   (cartão). Boleto/PIX chegam como "unpaid" e esperam o evento abaixo.
 * - checkout.session.async_payment_succeeded: pagamento assíncrono confirmado.
 * - checkout.session.async_payment_failed: só registra no log.
 *
 * Os créditos vêm do pacote (packageId) no servidor; o valor em
 * metadata.credits é ignorado.
 */
export async function handleStripeEvent(
  event: Stripe.Event
): Promise<WebhookOutcome> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== "paid") {
        return "awaiting_payment";
      }
      return creditSession(session, event.id);
    }

    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.warn("[stripe] pagamento assíncrono falhou", {
        eventId: event.id,
        sessionId: session.id,
        userId: session.metadata?.userId,
        packageId: session.metadata?.packageId,
      });
      return "payment_failed";
    }

    default:
      return "ignored";
  }
}

async function creditSession(
  session: Stripe.Checkout.Session,
  eventId: string
): Promise<WebhookOutcome> {
  const userId = session.metadata?.userId;
  const pkg = getPackage(String(session.metadata?.packageId ?? ""));

  if (!userId || !pkg) {
    console.error("[stripe] sessão paga sem userId/pacote válido", {
      eventId,
      sessionId: session.id,
      userId,
      packageId: session.metadata?.packageId,
    });
    return "invalid_metadata";
  }

  if (session.amount_total !== null && session.amount_total !== pkg.priceCents) {
    // Não bloqueia (o preço é fixado no servidor ao criar a sessão), mas
    // deixa rastro se o pacote mudou de preço entre o checkout e o pagamento.
    console.warn("[stripe] valor pago difere do preço atual do pacote", {
      sessionId: session.id,
      packageId: pkg.id,
      amountTotal: session.amount_total,
      priceCents: pkg.priceCents,
    });
  }

  const credited = await addPurchaseCredits(userId, pkg.credits, session.id);
  return credited ? "credited" : "duplicate";
}

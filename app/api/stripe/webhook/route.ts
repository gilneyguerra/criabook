import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { stripe } from "@/lib/stripe/client";
import { handleStripeEvent } from "@/lib/stripe/webhook";

/**
 * Webhook do Stripe. Verifica a assinatura (corpo cru via req.text) e delega
 * para handleStripeEvent, que credita de forma idempotente por session.id.
 * Erro de banco → 500, para o Stripe reenviar.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Webhook não configurado." }, {
      status: 503,
    });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Sem assinatura." }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Assinatura inválida." }, {
      status: 400,
    });
  }

  const outcome = await handleStripeEvent(event);
  return NextResponse.json({ received: true, outcome });
}

import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { stripe } from "@/lib/stripe/client";
import { addCredits } from "@/lib/credits";

/**
 * Webhook do Stripe. Em checkout.session.completed, credita os créditos do
 * pacote ao usuário (idempotente via refId = session.id).
 *
 * Lê o corpo cru (req.text) para verificar a assinatura.
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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const credits = Number(session.metadata?.credits ?? 0);
    if (userId && credits > 0) {
      await addCredits(userId, credits, "compra", session.id);
    }
  }

  return NextResponse.json({ received: true });
}

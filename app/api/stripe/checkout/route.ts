import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe/client";
import { getPackage } from "@/lib/stripe/packages";

export async function POST(request: Request) {
  if (!stripe) {
    return NextResponse.json(
      { error: "Pagamentos ainda não configurados." },
      { status: 503 }
    );
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { packageId } = await request.json().catch(() => ({}));
  const pkg = getPackage(String(packageId));
  if (!pkg) {
    return NextResponse.json({ error: "Pacote inválido." }, { status: 400 });
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    request.headers.get("origin") ??
    "http://localhost:3000";

  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "brl",
          unit_amount: pkg.priceCents,
          product_data: {
            name: `CriaBook — ${pkg.label} (${pkg.credits} créditos)`,
          },
        },
      },
    ],
    metadata: {
      userId: session.user.id,
      credits: String(pkg.credits),
      packageId: pkg.id,
    },
    success_url: `${origin}/dashboard/creditos?status=ok`,
    cancel_url: `${origin}/dashboard/creditos?status=cancel`,
  });

  return NextResponse.json({ url: checkout.url });
}

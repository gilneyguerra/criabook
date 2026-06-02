import { headers } from "next/headers";
import { Coins } from "lucide-react";

import { auth } from "@/lib/auth";
import { getBalance } from "@/lib/credits";
import { CREDIT_PACKAGES, formatBRL } from "@/lib/stripe/packages";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BuyButton } from "./_components/buy-button";

export default async function CreditosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  let balance = 0;
  if (session) {
    balance = await getBalance(session.user.id).catch(() => 0);
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border bg-background/70 p-8 text-center backdrop-blur">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Créditos
        </h1>
        <p className="mt-2 text-muted-foreground">
          Cada geração de texto e imagem consome créditos.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-medium">
          <Coins className="size-4 text-amber-500" />
          Saldo atual: {balance.toLocaleString("pt-BR")} créditos
        </div>
      </section>

      {status === "ok" && (
        <p className="rounded-md bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          Pagamento recebido! Seu saldo é atualizado em alguns instantes.
        </p>
      )}
      {status === "cancel" && (
        <p className="rounded-md bg-secondary px-4 py-3 text-sm text-muted-foreground">
          Compra cancelada.
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-3">
        {CREDIT_PACKAGES.map((pkg) => (
          <Card
            key={pkg.id}
            className={pkg.highlight ? "border-indigo-500/50 shadow-md" : ""}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {pkg.label}
                {pkg.highlight && (
                  <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs font-medium text-indigo-600">
                    popular
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                {pkg.credits.toLocaleString("pt-BR")} créditos
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-2xl font-bold">{formatBRL(pkg.priceCents)}</p>
              <BuyButton packageId={pkg.id} highlight={pkg.highlight} />
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Pagamento processado pela Stripe. Os preços são iniciais e podem mudar.
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function BuyButton({
  packageId,
  highlight,
}: {
  packageId: string;
  highlight?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? "Não foi possível iniciar a compra.");
        setPending(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Falha de rede. Tente novamente.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={buy}
        disabled={pending}
        variant={highlight ? "default" : "outline"}
        className="w-full"
      >
        {pending ? "Redirecionando..." : "Comprar"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

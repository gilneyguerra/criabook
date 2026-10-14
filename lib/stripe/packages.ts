/**
 * Pacotes de crédito à venda. Preços em centavos (BRL) — placeholders,
 * ajuste conforme a margem (custo de IA por livro). `credits` é o que o
 * usuário recebe; o consumo por geração é medido em lib/ai/metering.ts.
 */
export type CreditPackage = {
  id: string;
  label: string;
  credits: number;
  priceCents: number; // BRL
  highlight?: boolean;
};

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "start", label: "Início", credits: 500, priceCents: 1990 },
  {
    id: "author",
    label: "Autor",
    credits: 1500,
    priceCents: 4990,
    highlight: true,
  },
  { id: "pro", label: "Profissional", credits: 4000, priceCents: 11990 },
];

export function getPackage(id: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.id === id);
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

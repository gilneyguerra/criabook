import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { suggestKeywords } from "@/lib/ai/claude";
import { getCategory } from "@/lib/keywords";
import { creditErrorResponse, withCredits } from "@/lib/ai/with-credits";
import { InsufficientCreditsError } from "@/lib/credits";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { categoryKey, context } = await request.json().catch(() => ({}));
  const category = getCategory(String(categoryKey));
  if (!category) {
    return NextResponse.json({ error: "Categoria inválida." }, { status: 400 });
  }

  try {
    // Vazio (sem API key ou resposta vazia) lança → estorna e cai no fallback.
    const suggestions = await withCredits(session.user.id, "suggest", async () => {
      const out = await suggestKeywords({
        categoryLabel: category.label,
        context: typeof context === "string" ? context.slice(0, 2000) : undefined,
      });
      if (out.length === 0) throw new Error("sem sugestões");
      return out;
    });
    return NextResponse.json({ suggestions });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) return creditErrorResponse(err)!;
    // Falha de IA → fallback estático (não bloqueia o usuário; nada cobrado).
  }

  return NextResponse.json({ suggestions: category.fallback, fallback: true });
}

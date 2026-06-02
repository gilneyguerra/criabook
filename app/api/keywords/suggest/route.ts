import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { suggestKeywords } from "@/lib/ai/claude";
import { getCategory } from "@/lib/keywords";

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
    const suggestions = await suggestKeywords({
      categoryLabel: category.label,
      context: typeof context === "string" ? context : undefined,
    });
    // Sem API key (ou resposta vazia) → cai no fallback estático.
    if (suggestions.length > 0) {
      return NextResponse.json({ suggestions });
    }
  } catch {
    // Falha de IA → fallback (não bloqueia o usuário).
  }

  return NextResponse.json({ suggestions: category.fallback, fallback: true });
}

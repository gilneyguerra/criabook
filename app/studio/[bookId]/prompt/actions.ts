"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { updateBookBrief, upsertKeyword } from "@/lib/db/queries";
import { KEYWORD_CATEGORIES, type KeywordCategoryKey } from "@/lib/keywords";

export type BriefPayload = {
  title: string;
  selections: Record<string, string[]>;
  // Camada de ofício (wizard)
  type?: "fiction" | "nonfiction";
  logline?: string;
  audience?: string;
  pov?: string;
  tone?: string;
  structureMethod?: string;
};

export async function saveBrief(bookId: string, payload: BriefPayload) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };

  // Alimenta a base compartilhada de palavras-chave (dedup exato + semântico).
  for (const cat of KEYWORD_CATEGORIES) {
    const values = payload.selections[cat.key] ?? [];
    for (const v of values) {
      await upsertKeyword(session.user.id, cat.key as KeywordCategoryKey, v);
    }
  }

  const genre = payload.selections.genre?.[0];
  const saved = await updateBookBrief(bookId, session.user.id, {
    title: payload.title.trim() || "Sem título",
    genre,
    brief: payload.selections,
    type: payload.type,
    logline: payload.logline?.trim() || undefined,
    audience: payload.audience?.trim() || undefined,
    pov: payload.pov || undefined,
    tone: payload.tone?.trim() || undefined,
    structureMethod: payload.structureMethod || undefined,
  });

  if (!saved) return { error: "Livro não encontrado." };
  return { ok: true };
}

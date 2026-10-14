"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getBookForUser, saveBookMatter } from "@/lib/db/queries";
import { bookContextText } from "@/lib/ai/prompts";
import { suggestMatterField, type MatterKind } from "@/lib/ai/claude";
import type { Matter } from "@/lib/matter";
import { creditedAction } from "@/lib/ai/with-credits";

export async function saveMatter(bookId: string, matter: Matter) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };

  await saveBookMatter(bookId, matter);
  return { ok: true };
}

/** Sugere o texto de um campo (dedicatória, epígrafe, prefácio, agradecimentos, CTA). */
export async function suggestMatter(bookId: string, kind: MatterKind) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };

  const ctx = bookContextText({
    title: book.title,
    type: book.type,
    logline: book.logline,
    genre: book.genre,
    audience: book.audience,
    pov: book.pov,
    tone: book.tone,
    structureMethod: book.structureMethod,
    brief: book.brief as Record<string, string[]>,
  });
  const r = await creditedAction(session.user.id, "suggest", () => suggestMatterField(kind, ctx), {
    empty: "Não foi possível sugerir agora.",
  });
  if ("error" in r) return { error: r.error, code: r.code };
  return { ok: true, text: r.value };
}

"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  getBookForUser,
  getStoryBeats,
  replaceStoryBeats,
  updateStoryBeat,
} from "@/lib/db/queries";
import { generateBeats } from "@/lib/ai/claude";
import { bookContextText } from "@/lib/ai/prompts";
import { getTemplate } from "@/lib/structure";
import { creditedAction } from "@/lib/ai/with-credits";

export async function generateStructureAction(bookId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };

  const template = getTemplate(book.structureMethod);
  const context = bookContextText({
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

  const r = await creditedAction(
    session.user.id,
    "structure",
    async () => {
      const filled = await generateBeats(
        context,
        template.map((t) => t.label)
      );
      if (!filled.length) return null;
      await replaceStoryBeats(
        bookId,
        template.map((t, i) => ({
          order: i,
          beatType: t.beatType,
          title: filled[i]?.title?.trim() || t.label,
          summary: filled[i]?.description?.trim() || "",
        }))
      );
      return filled.length;
    },
    {
      empty: "Não foi possível gerar a estrutura agora.",
      failure: "Falha ao gerar a estrutura.",
    }
  );
  if ("error" in r) return { error: r.error, code: r.code };

  const saved = await getStoryBeats(bookId);
  return {
    ok: true,
    beats: saved.map((b) => ({
      id: b.id,
      order: b.order,
      title: b.title ?? "",
      summary: b.summary ?? "",
      beatType: b.beatType ?? "beat",
    })),
  };
}

export async function saveBeatAction(
  bookId: string,
  beatId: string,
  data: { title?: string; summary?: string }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };

  await updateStoryBeat(bookId, beatId, data);
  return { ok: true };
}

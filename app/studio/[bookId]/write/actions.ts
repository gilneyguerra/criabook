"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  updateChapterContent,
  getBookForUser,
  createVersion,
} from "@/lib/db/queries";

export async function saveChapter(
  chapterId: string,
  data: { contentJson: unknown; contentText: string }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };

  const saved = await updateChapterContent(chapterId, session.user.id, data);
  if (!saved) return { error: "Capítulo não encontrado." };

  return { ok: true, savedAt: Date.now() };
}

/** Cria um snapshot (versão) do capítulo atual — botão "Versão". */
export async function snapshotChapter(
  bookId: string,
  chapterId: string,
  data: { contentJson: unknown; contentText: string },
  label?: string
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };

  // Garante que o conteúdo atual está salvo, depois registra a versão.
  await updateChapterContent(chapterId, session.user.id, data);
  await createVersion(bookId, chapterId, label || "Versão manual", {
    contentText: data.contentText,
    contentJson: data.contentJson,
  });
  return { ok: true };
}

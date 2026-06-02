"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  getBookForUser,
  getVersionRow,
  updateChapterContent,
  createVersion,
  type ChapterSnapshot,
} from "@/lib/db/queries";

export async function restoreVersion(bookId: string, versionId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };

  const version = await getVersionRow(bookId, versionId);
  if (!version || !version.chapterId) return { error: "Versão não encontrada." };

  const snap = version.snapshot as ChapterSnapshot;
  await updateChapterContent(version.chapterId, session.user.id, {
    contentJson: snap.contentJson,
    contentText: snap.contentText,
  });
  // Histórico nunca é destruído: o rollback também vira uma versão.
  await createVersion(bookId, version.chapterId, "Rollback", snap);

  return { ok: true };
}

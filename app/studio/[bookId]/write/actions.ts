"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  updateChapterContent,
  getBookForUser,
  createVersion,
} from "@/lib/db/queries";
import { normalize } from "@/lib/text/normalizer";
import { getLayoutProfile } from "@/lib/layout/profile";
import { textToDoc } from "@/lib/tiptap";

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

/**
 * Normaliza tipograficamente o texto atual do capítulo (Camada A): aspas
 * curvas, travessão de diálogo, reticências, sem espaços duplos. Cria uma
 * versão do estado ANTERIOR (rollback) antes de salvar o normalizado.
 */
export async function normalizeChapter(
  bookId: string,
  chapterId: string,
  contentText: string
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };

  const profile = getLayoutProfile(book.layoutProfileId, book.type);

  // Snapshot do estado pré-normalização (segurança/rollback).
  await createVersion(bookId, chapterId, "Antes de normalizar", {
    contentText,
    contentJson: textToDoc(contentText),
  });

  const normalized = normalize(contentText, profile);
  const saved = await updateChapterContent(chapterId, session.user.id, {
    contentText: normalized,
    contentJson: textToDoc(normalized),
  });
  if (!saved) return { error: "Capítulo não encontrado." };

  return { ok: true, contentText: normalized };
}

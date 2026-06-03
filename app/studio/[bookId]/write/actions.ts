"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  updateChapterContent,
  getBookForUser,
  createVersion,
  createChapter,
  deleteChapter as deleteChapterRow,
  getChapters,
} from "@/lib/db/queries";
import { normalize } from "@/lib/text/normalizer";
import { getLayoutProfile } from "@/lib/layout/profile";
import { textToDoc } from "@/lib/tiptap";

/**
 * Cria um capítulo VAZIO (sem geração por IA). O conteúdo é escrito à mão pelo
 * usuário ou gerado depois com "Continuar geração".
 */
export async function createEmptyChapter(bookId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };

  const existing = await getChapters(bookId);
  // max(index)+1 evita colisão de índice após exclusões (gaps na numeração).
  const index = existing.reduce((m, c) => Math.max(m, c.index), 0) + 1;
  const ch = await createChapter(bookId, index, `Capítulo ${index}`, "pending");
  await updateChapterContent(ch.id, session.user.id, {
    contentJson: textToDoc(""),
    contentText: "",
  });
  return { ok: true, chapter: { id: ch.id, index, title: ch.title ?? `Capítulo ${index}`, contentText: "" } };
}

/** Apaga um capítulo inteiro (todo o conteúdo é perdido). Posse verificada. */
export async function deleteChapter(bookId: string, chapterId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };

  const deleted = await deleteChapterRow(chapterId, session.user.id);
  if (!deleted) return { error: "Capítulo não encontrado." };
  return { ok: true };
}

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

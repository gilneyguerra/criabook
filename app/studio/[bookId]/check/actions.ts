"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  getBookForUser,
  getChapters,
  updateChapterContent,
  createVersion,
} from "@/lib/db/queries";
import { reviseChapterForIssue } from "@/lib/ai/claude";
import { runContinuityCheck } from "@/lib/verify/continuity";
import {
  replaceOpenIssues,
  getIssues,
  getIssueRow,
  setIssueStatus,
  getThreads,
  getTimelineEvents,
} from "@/lib/memory/ledgers";
import { creditedAction } from "@/lib/ai/with-credits";
import { getLayoutProfile } from "@/lib/layout/profile";
import { normalize } from "@/lib/text/normalizer";
import { textToDoc } from "@/lib/tiptap";
import { indexChapter } from "@/lib/ai/rag";

/** Carrega o painel: issues persistidas + fios + timeline. */
export async function loadConsistencyPanel(bookId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };

  const [issues, threads, timeline] = await Promise.all([
    getIssues(bookId),
    getThreads(bookId),
    getTimelineEvents(bookId),
  ]);
  return { ok: true, issues, threads, timeline };
}

/** Roda o detector e PERSISTE as issues (substitui as abertas). */
export async function runConsistencyCheck(bookId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };

  const chapters = await getChapters(bookId);
  if (!chapters.length)
    return { error: "Gere pelo menos um capítulo antes de revisar." };

  // Lista vazia de issues é resultado válido: embrulhada em objeto para não
  // ser tratada como "IA sem resposta".
  const r = await creditedAction(
    session.user.id,
    "consistency",
    async () => ({ issues: await runContinuityCheck(bookId) }),
    { empty: "Falha ao revisar. Tente novamente." }
  );
  if ("error" in r) return r;
  const { issues } = r.value;

  await replaceOpenIssues(
    bookId,
    issues.map((i) => ({
      chapter: parseChapterNum(i.location) ?? parseChapterNum(i.description),
      type: i.type,
      severity: i.severity,
      description: i.description + (i.location ? ` (${i.location})` : ""),
      conflictsWith: i.conflictsWith ?? null,
    }))
  );

  return { ok: true, issues: await getIssues(bookId) };
}

/** Extrai o nº do capítulo de um texto tipo "cap. 8" / "Capítulo 8". */
function parseChapterNum(s?: string | null): number | null {
  if (!s) return null;
  const m = s.match(/cap[íi]?t?u?l?o?\.?\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

export async function resolveIssue(bookId: string, issueId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };
  await setIssueStatus(bookId, issueId, "resolved");
  return { ok: true };
}

export async function ignoreIssue(bookId: string, issueId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };
  await setIssueStatus(bookId, issueId, "ignored");
  return { ok: true };
}

/**
 * Auto-revisão dirigida (issues hard): regenera o capítulo em conflito com o
 * fato correto injetado, criando uma versão (rollback) antes de salvar.
 */
export async function correctPassage(bookId: string, issueId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };

  const issue = await getIssueRow(bookId, issueId);
  if (!issue) return { error: "Inconsistência não encontrada." };
  if (!issue.chapter)
    return { error: "Esta inconsistência não aponta um capítulo específico." };

  const chapters = await getChapters(bookId);
  const chapter = chapters.find((c) => c.index === issue.chapter);
  if (!chapter || !chapter.contentText)
    return { error: "Capítulo do conflito não encontrado." };

  const original = chapter.contentText;
  const r = await creditedAction(
    session.user.id,
    "revise",
    async () => {
      // Snapshot antes (rollback).
      await createVersion(bookId, chapter.id, "Antes de corrigir consistência", {
        contentText: original,
        contentJson: textToDoc(original),
      });

      const revised = await reviseChapterForIssue({
        text: original,
        description: issue.description,
        conflictsWith: issue.conflictsWith,
      });
      if (!revised) return null;

      const profile = getLayoutProfile(book.layoutProfileId, book.type);
      const normalized = normalize(revised, profile);
      const saved = await updateChapterContent(chapter.id, session.user.id, {
        contentText: normalized,
        contentJson: textToDoc(normalized),
      });
      if (!saved) throw new Error("capítulo não encontrado ao salvar");
      return normalized;
    },
    {
      empty: "Não foi possível corrigir agora. Tente de novo.",
      failure: "Não foi possível corrigir agora. Tente de novo.",
    }
  );
  if ("error" in r) return r;

  try {
    await indexChapter(bookId, chapter.id, r.value);
  } catch {}
  await setIssueStatus(bookId, issueId, "resolved");

  return { ok: true, chapter: chapter.index };
}

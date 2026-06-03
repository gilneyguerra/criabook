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
import { getBalance, debitCredits, creditsForUsage } from "@/lib/credits";
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

  const estimate = creditsForUsage({ tokensIn: 3000, tokensOut: 2000 });
  const balance = await getBalance(session.user.id);
  if (balance < estimate) return { error: "Créditos insuficientes." };

  let issues;
  try {
    issues = await runContinuityCheck(bookId);
  } catch {
    return { error: "Falha ao revisar. Tente novamente." };
  }
  try {
    await debitCredits(session.user.id, estimate, "verificação de consistência");
  } catch {}

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

  const estimate = creditsForUsage({ tokensIn: 4000, tokensOut: 4000 });
  const balance = await getBalance(session.user.id);
  if (balance < estimate) return { error: "Créditos insuficientes." };

  // Snapshot antes (rollback).
  await createVersion(bookId, chapter.id, "Antes de corrigir consistência", {
    contentText: chapter.contentText,
    contentJson: textToDoc(chapter.contentText),
  });

  const revised = await reviseChapterForIssue({
    text: chapter.contentText,
    description: issue.description,
    conflictsWith: issue.conflictsWith,
  });
  if (!revised) return { error: "Não foi possível corrigir agora. Tente de novo." };

  const profile = getLayoutProfile(book.layoutProfileId, book.type);
  const normalized = normalize(revised, profile);

  const saved = await updateChapterContent(chapter.id, session.user.id, {
    contentText: normalized,
    contentJson: textToDoc(normalized),
  });
  if (!saved) return { error: "Capítulo não encontrado." };

  try {
    await indexChapter(bookId, chapter.id, normalized);
  } catch {}
  try {
    await debitCredits(session.user.id, estimate, "correção de consistência", chapter.id);
  } catch {}
  await setIssueStatus(bookId, issueId, "resolved");

  return { ok: true, chapter: chapter.index };
}

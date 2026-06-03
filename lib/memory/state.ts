/**
 * Estado do mundo (REGRAS_CONSISTENCIA §3.4) — a "foto" compacta ao fim do
 * capítulo N + resumo rolante cumulativo. É o que se injeta ao escrever N+1,
 * em vez do texto bruto: compacto e determinístico, escala para livros longos.
 */

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { worldStateSnapshots } from "@/lib/db/schema";

export type WorldStatePayload = {
  characters?: { name: string; location?: string; state?: string }[];
  openThreads?: string[];
  items?: string[];
};

/** Último snapshot do livro (maior as_of_chapter). */
export async function getLatestWorldState(bookId: string) {
  const rows = await db
    .select()
    .from(worldStateSnapshots)
    .where(eq(worldStateSnapshots.bookId, bookId))
    .orderBy(desc(worldStateSnapshots.asOfChapter))
    .limit(1);
  return rows[0] ?? null;
}

/** Resumo rolante cumulativo até agora ("" se ainda não há snapshot). */
export async function getRollingSummary(bookId: string): Promise<string> {
  const latest = await getLatestWorldState(bookId);
  return latest?.summary ?? "";
}

const MAX_SUMMARY = 4000;

/**
 * Grava o snapshot do fim do capítulo N. Idempotente por capítulo: remove um
 * snapshot anterior do mesmo capítulo antes de inserir (re-geração/edição).
 */
export async function saveWorldStateSnapshot(
  bookId: string,
  asOfChapter: number,
  summary: string,
  payload?: WorldStatePayload
) {
  await db
    .delete(worldStateSnapshots)
    .where(
      and(
        eq(worldStateSnapshots.bookId, bookId),
        eq(worldStateSnapshots.asOfChapter, asOfChapter)
      )
    );
  await db.insert(worldStateSnapshots).values({
    bookId,
    asOfChapter,
    summary: summary.slice(0, MAX_SUMMARY),
    payload: payload ?? null,
  });
}

/**
 * Resumo rolante = resumo anterior + resumo do novo capítulo, truncado para
 * caber no orçamento (mantém o começo e prioriza o mais recente).
 */
export function buildCumulativeSummary(
  prevSummary: string,
  chapterIndex: number,
  chapterSummary: string
): string {
  const piece = chapterSummary.trim()
    ? `Cap. ${chapterIndex}: ${chapterSummary.trim()}`
    : "";
  const combined = [prevSummary.trim(), piece].filter(Boolean).join("\n");
  if (combined.length <= MAX_SUMMARY) return combined;
  // Excedeu: mantém o trecho mais recente (o fim) dentro do orçamento.
  return combined.slice(combined.length - MAX_SUMMARY);
}

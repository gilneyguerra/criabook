/**
 * Ledgers do Motor de Consistência (REGRAS_CONSISTENCIA §3).
 *
 * Memória resgatável: fatos atômicos com PROVENIÊNCIA (capítulo de origem).
 * É o que torna a verificação determinística (contradiz algum fato registrado?).
 *
 * Escopo: todas as funções recebem `bookId`; a posse do livro é verificada na
 * camada de action/route (padrão do projeto: getBookForUser antes de chamar).
 */

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  canonFacts,
  characterKnowledge,
  plotThreads,
  describedItems,
  consistencyIssues,
  timelineEvents,
} from "@/lib/db/schema";

/* ----------------------------- Canon facts ----------------------------- */

export type CanonFactInput = {
  subject: string;
  attribute: string;
  value: string;
  establishedInChapter: number;
};

export async function addCanonFacts(bookId: string, facts: CanonFactInput[]) {
  if (!facts.length) return;
  await db.insert(canonFacts).values(facts.map((f) => ({ ...f, bookId })));
}

export async function getActiveCanonFacts(bookId: string) {
  return db
    .select()
    .from(canonFacts)
    .where(and(eq(canonFacts.bookId, bookId), eq(canonFacts.status, "active")))
    .orderBy(canonFacts.subject, canonFacts.establishedInChapter);
}

export async function retconFact(bookId: string, id: string) {
  await db
    .update(canonFacts)
    .set({ status: "retconned" })
    .where(and(eq(canonFacts.id, id), eq(canonFacts.bookId, bookId)));
}

/* -------------------------- Character knowledge ------------------------- */

export type KnowledgeInput = {
  character: string;
  fact: string;
  learnedInChapter: number;
};

export async function addKnowledge(bookId: string, items: KnowledgeInput[]) {
  if (!items.length) return;
  await db
    .insert(characterKnowledge)
    .values(items.map((k) => ({ ...k, bookId })));
}

export async function getCharacterKnowledge(bookId: string) {
  return db
    .select()
    .from(characterKnowledge)
    .where(eq(characterKnowledge.bookId, bookId))
    .orderBy(characterKnowledge.character, characterKnowledge.learnedInChapter);
}

/* ----------------------------- Plot threads ---------------------------- */

export async function openThreads(
  bookId: string,
  items: { description: string; openedInChapter: number }[]
) {
  if (!items.length) return;
  await db.insert(plotThreads).values(items.map((t) => ({ ...t, bookId })));
}

export async function getThreads(bookId: string) {
  return db
    .select()
    .from(plotThreads)
    .where(eq(plotThreads.bookId, bookId))
    .orderBy(plotThreads.openedInChapter);
}

export async function getOpenThreads(bookId: string) {
  return db
    .select()
    .from(plotThreads)
    .where(and(eq(plotThreads.bookId, bookId), eq(plotThreads.status, "open")))
    .orderBy(plotThreads.openedInChapter);
}

export async function closeThread(
  bookId: string,
  id: string,
  closedInChapter: number
) {
  await db
    .update(plotThreads)
    .set({ status: "resolved", closedInChapter })
    .where(and(eq(plotThreads.id, id), eq(plotThreads.bookId, bookId)));
}

/* ---------------------------- Described items -------------------------- */

export async function addDescribedItems(
  bookId: string,
  items: { subject: string; describedInChapter: number }[]
) {
  if (!items.length) return;
  await db.insert(describedItems).values(items.map((d) => ({ ...d, bookId })));
}

export async function getDescribedItems(bookId: string) {
  return db
    .select()
    .from(describedItems)
    .where(eq(describedItems.bookId, bookId))
    .orderBy(desc(describedItems.describedInChapter));
}

/* ----------------------- Timeline (Event Ledger) ----------------------- */

export type TimelineEventInput = {
  order: number; // storyOrder (tempo da história)
  description: string;
  chapterRef?: number | null; // narrativeChapter
  participants?: string[];
  location?: string | null;
  storyTime?: string | null;
};

export async function addTimelineEvents(
  bookId: string,
  events: TimelineEventInput[]
) {
  if (!events.length) return;
  await db.insert(timelineEvents).values(
    events.map((e) => ({
      bookId,
      order: e.order,
      description: e.description,
      chapterRef: e.chapterRef ?? null,
      participants: e.participants ?? null,
      location: e.location ?? null,
      storyTime: e.storyTime ?? null,
    }))
  );
}

/** Eventos em ordem de TEMPO DA HISTÓRIA (storyOrder), não de narração. */
export async function getTimelineEvents(bookId: string) {
  return db
    .select()
    .from(timelineEvents)
    .where(eq(timelineEvents.bookId, bookId))
    .orderBy(timelineEvents.order);
}

/* --------------------- Limpeza de estado por capítulo ------------------- */

/**
 * Apaga TUDO que um capítulo havia registrado (fatos, conhecimento, fios,
 * descritos, eventos de timeline cujo índice de origem == `index`). Usado ao
 * REGERAR um capítulo: o "novo começo" não herda o estado da versão antiga.
 * Não afeta os demais capítulos.
 */
export async function clearChapterState(bookId: string, index: number) {
  await Promise.all([
    db
      .delete(canonFacts)
      .where(
        and(eq(canonFacts.bookId, bookId), eq(canonFacts.establishedInChapter, index))
      ),
    db
      .delete(characterKnowledge)
      .where(
        and(
          eq(characterKnowledge.bookId, bookId),
          eq(characterKnowledge.learnedInChapter, index)
        )
      ),
    db
      .delete(plotThreads)
      .where(
        and(eq(plotThreads.bookId, bookId), eq(plotThreads.openedInChapter, index))
      ),
    db
      .delete(describedItems)
      .where(
        and(
          eq(describedItems.bookId, bookId),
          eq(describedItems.describedInChapter, index)
        )
      ),
    db
      .delete(timelineEvents)
      .where(
        and(eq(timelineEvents.bookId, bookId), eq(timelineEvents.chapterRef, index))
      ),
  ]);
}

/* -------------------------- Consistency issues ------------------------- */

export type IssueType =
  | "hallucination"
  | "repetition"
  | "timeline"
  | "knowledge"
  | "thread";
export type IssueSeverity = "hard" | "soft";

export type IssueInput = {
  chapter?: number | null;
  type: IssueType;
  severity: IssueSeverity;
  description: string;
  conflictsWith?: string | null;
};

export async function addIssues(bookId: string, issues: IssueInput[]) {
  if (!issues.length) return;
  await db.insert(consistencyIssues).values(issues.map((i) => ({ ...i, bookId })));
}

/** Substitui as issues abertas do livro pelas novas (re-rodar o detector). */
export async function replaceOpenIssues(bookId: string, issues: IssueInput[]) {
  await db
    .delete(consistencyIssues)
    .where(
      and(
        eq(consistencyIssues.bookId, bookId),
        eq(consistencyIssues.status, "open")
      )
    );
  await addIssues(bookId, issues);
}

export async function getIssues(bookId: string) {
  return db
    .select()
    .from(consistencyIssues)
    .where(eq(consistencyIssues.bookId, bookId))
    .orderBy(desc(consistencyIssues.createdAt));
}

export async function getIssueRow(bookId: string, id: string) {
  const rows = await db
    .select()
    .from(consistencyIssues)
    .where(and(eq(consistencyIssues.id, id), eq(consistencyIssues.bookId, bookId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function setIssueStatus(
  bookId: string,
  id: string,
  status: "open" | "resolved" | "ignored"
) {
  await db
    .update(consistencyIssues)
    .set({ status })
    .where(and(eq(consistencyIssues.id, id), eq(consistencyIssues.bookId, bookId)));
}

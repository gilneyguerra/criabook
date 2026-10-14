"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  updateBookBrief,
  upsertKeyword,
  getBookForUser,
  insertBibleEntry,
} from "@/lib/db/queries";
import { KEYWORD_CATEGORIES, type KeywordCategoryKey } from "@/lib/keywords";
import {
  generateBible,
  suggestField,
  type BibleSection,
  type GeneratedBible,
} from "@/lib/ai/claude";
import { bookContextText } from "@/lib/ai/prompts";
import { indexBibleEntry } from "@/lib/ai/rag";
import { creditedAction } from "@/lib/ai/with-credits";

export type BriefPayload = {
  title: string;
  selections: Record<string, string[]>;
  // Camada de ofício (wizard)
  type?: "fiction" | "nonfiction";
  logline?: string;
  audience?: string;
  pov?: string;
  tone?: string;
  structureMethod?: string;
  layoutProfileId?: string;
};

export async function saveBrief(bookId: string, payload: BriefPayload) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };

  // Alimenta a base compartilhada de palavras-chave (dedup exato + semântico).
  for (const cat of KEYWORD_CATEGORIES) {
    const values = payload.selections[cat.key] ?? [];
    for (const v of values) {
      await upsertKeyword(session.user.id, cat.key as KeywordCategoryKey, v);
    }
  }

  const genre = payload.selections.genre?.[0];
  const saved = await updateBookBrief(bookId, session.user.id, {
    title: payload.title.trim() || "Sem título",
    genre,
    brief: payload.selections,
    type: payload.type,
    logline: payload.logline?.trim() || undefined,
    audience: payload.audience?.trim() || undefined,
    pov: payload.pov || undefined,
    tone: payload.tone?.trim() || undefined,
    structureMethod: payload.structureMethod || undefined,
    layoutProfileId: payload.layoutProfileId || undefined,
  });

  if (!saved) return { error: "Livro não encontrado." };
  return { ok: true };
}

/* ------------------- Geração da Bíblia por IA (FLUXO_E_UX) ------------------- */

type BookRow = Awaited<ReturnType<typeof getBookForUser>>;

function ctxFromBook(book: NonNullable<BookRow>): string {
  return bookContextText({
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
}

/** Persiste uma Bíblia gerada e indexa no RAG (timeline não vai pro RAG). */
async function persistBible(bookId: string, gen: GeneratedBible) {
  let count = 0;
  for (const c of gen.characters) {
    if (!c.name?.trim()) continue;
    const row = await insertBibleEntry(bookId, "character", {
      name: c.name,
      role: c.role ?? "",
      appearance: c.appearance ?? "",
      traits: c.traits ?? "",
      arc: c.arc ?? "",
    });
    await indexBibleEntry(
      bookId,
      "character",
      row.id,
      `${c.name} (${c.role ?? ""}): ${c.appearance ?? ""}. ${c.traits ?? ""}. ${c.arc ?? ""}`
    ).catch(() => {});
    count++;
  }
  for (const l of gen.locations) {
    if (!l.name?.trim()) continue;
    const row = await insertBibleEntry(bookId, "location", {
      name: l.name,
      description: l.description ?? "",
    });
    await indexBibleEntry(bookId, "location", row.id, `${l.name}: ${l.description ?? ""}`).catch(
      () => {}
    );
    count++;
  }
  for (const r of gen.worldRules) {
    if (!r.rule?.trim()) continue;
    const row = await insertBibleEntry(bookId, "world_rule", {
      category: r.category ?? "",
      rule: r.rule,
    });
    await indexBibleEntry(bookId, "world_rule", row.id, `${r.category ?? ""}: ${r.rule}`).catch(
      () => {}
    );
    count++;
  }
  // Timeline não vai pro RAG (não há ragSourceType para ela) — só persiste.
  for (const t of gen.timeline) {
    if (!t.description?.trim()) continue;
    await insertBibleEntry(bookId, "timeline", {
      description: t.description,
      order: String(t.order ?? 0),
    });
    count++;
  }
  return count;
}

/** Cascata: gera a Bíblia inteira a partir da base. */
export async function generateWorld(bookId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };
  if (!book.logline?.trim() && !book.genre?.trim())
    return { error: "Preencha ao menos logline ou gênero na Base primeiro." };

  const r = await creditedAction(
    session.user.id,
    "bible",
    async () => persistBible(bookId, await generateBible(ctxFromBook(book))),
    { empty: "Não foi possível gerar agora. Tente novamente." }
  );
  if ("error" in r) return { error: r.error, code: r.code };
  return { ok: true, count: r.value };
}

/** Gera só uma seção da Bíblia. */
export async function generateBibleSection(bookId: string, section: BibleSection) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };

  const r = await creditedAction(
    session.user.id,
    "bible",
    async () => persistBible(bookId, await generateBible(ctxFromBook(book), section)),
    { empty: "Não foi possível gerar agora. Tente novamente." }
  );
  if ("error" in r) return { error: r.error, code: r.code };
  return { ok: true, count: r.value };
}

/** Sugere o texto de um campo da Base (não persiste; o cliente preenche). */
export async function suggestFieldAction(
  bookId: string,
  kind: "logline" | "audience" | "tone"
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };
  const r = await creditedAction(
    session.user.id,
    "suggest",
    () => suggestField(kind, ctxFromBook(book)),
    { empty: "Não foi possível sugerir agora." }
  );
  if ("error" in r) return { error: r.error, code: r.code };
  return { ok: true, text: r.value };
}

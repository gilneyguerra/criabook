import { and, cosineDistance, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  books,
  bookMeta,
  chapters,
  keywords,
  characters,
  locations,
  worldRules,
  timelineEvents,
  glossaryTerms,
  storyBeats,
  versions,
  chapterImages,
  covers,
} from "@/lib/db/schema";
import { embedText } from "@/lib/ai/embeddings";
import type { KeywordCategoryKey } from "@/lib/keywords";

type BookStatus = "draft" | "generating" | "review" | "done";

// Distância de cosseno máxima para considerar duas keywords "iguais"
// (0 = idênticas, 1 = ortogonais). ~0.12 ≈ similaridade > 0.88. Ajustável.
const SEMANTIC_DEDUP_THRESHOLD = 0.12;

/**
 * Helpers de acesso a dados ESCOPADOS PELO USUÁRIO.
 * Substituem a RLS do Supabase: toda leitura/escrita filtra por owner/userId.
 * Use sempre estes helpers (e não `db` direto) para dados de um usuário.
 */

export async function getUserBooks(userId: string) {
  return db
    .select({
      id: books.id,
      title: books.title,
      genre: books.genre,
      status: books.status,
      updatedAt: books.updatedAt,
      coverUrl: covers.ebookCoverUrl,
    })
    .from(books)
    .leftJoin(covers, eq(covers.bookId, books.id))
    .where(eq(books.ownerId, userId))
    .orderBy(desc(books.updatedAt));
}

export async function getBookForUser(bookId: string, userId: string) {
  const rows = await db
    .select()
    .from(books)
    .where(and(eq(books.id, bookId), eq(books.ownerId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createBookForUser(
  userId: string,
  data: { title?: string; genre?: string } = {}
) {
  const rows = await db
    .insert(books)
    .values({ ownerId: userId, ...data })
    .returning();
  return rows[0];
}

export async function updateBookBrief(
  bookId: string,
  userId: string,
  data: {
    title?: string;
    genre?: string;
    brief: unknown;
    type?: "fiction" | "nonfiction";
    logline?: string;
    audience?: string;
    pov?: string;
    tone?: string;
    structureMethod?: string;
    layoutProfileId?: string;
  }
) {
  // Drizzle ignora chaves `undefined` no SET (não sobrescreve).
  const rows = await db
    .update(books)
    .set({
      title: data.title,
      genre: data.genre,
      type: data.type,
      logline: data.logline,
      audience: data.audience,
      pov: data.pov,
      tone: data.tone,
      structureMethod: data.structureMethod,
      layoutProfileId: data.layoutProfileId,
      brief: data.brief,
      updatedAt: new Date(),
    })
    .where(and(eq(books.id, bookId), eq(books.ownerId, userId)))
    .returning();
  return rows[0] ?? null;
}

async function incrementKeyword(id: string) {
  await db
    .update(keywords)
    .set({ usageCount: sql`${keywords.usageCount} + 1` })
    .where(eq(keywords.id, id));
}

/* ----------------------- Imagens de capítulo (Fase C) ----------------------- */

export async function addChapterImage(
  chapterId: string,
  data: { storagePath: string; prompt?: string; model?: string }
) {
  const rows = await db
    .insert(chapterImages)
    .values({
      chapterId,
      storagePath: data.storagePath,
      prompt: data.prompt,
      model: data.model,
    })
    .returning();
  return rows[0];
}

export async function getChapterImages(chapterId: string) {
  return db
    .select()
    .from(chapterImages)
    .where(eq(chapterImages.chapterId, chapterId))
    .orderBy(chapterImages.position);
}

/* ----------------------- Versionamento (Fase B) ----------------------- */

export type ChapterSnapshot = { contentText: string; contentJson: unknown };

export async function createVersion(
  bookId: string,
  chapterId: string,
  label: string,
  snapshot: ChapterSnapshot
) {
  await db.insert(versions).values({ bookId, chapterId, label, snapshot });
}

export async function getVersions(bookId: string) {
  return db
    .select({
      id: versions.id,
      label: versions.label,
      chapterId: versions.chapterId,
      chapterTitle: chapters.title,
      createdAt: versions.createdAt,
    })
    .from(versions)
    .leftJoin(chapters, eq(chapters.id, versions.chapterId))
    .where(eq(versions.bookId, bookId))
    .orderBy(desc(versions.createdAt))
    .limit(100);
}

export async function getVersionRow(bookId: string, versionId: string) {
  const rows = await db
    .select()
    .from(versions)
    .where(and(eq(versions.id, versionId), eq(versions.bookId, bookId)))
    .limit(1);
  return rows[0] ?? null;
}

/* ----------------------- Story beats / estrutura (Fase B) ----------------------- */

export async function getStoryBeats(bookId: string) {
  return db
    .select()
    .from(storyBeats)
    .where(eq(storyBeats.bookId, bookId))
    .orderBy(storyBeats.order);
}

export async function replaceStoryBeats(
  bookId: string,
  beats: { order: number; title: string; summary: string; beatType: string }[]
) {
  await db.delete(storyBeats).where(eq(storyBeats.bookId, bookId));
  if (beats.length) {
    await db.insert(storyBeats).values(beats.map((b) => ({ bookId, ...b })));
  }
}

export async function updateStoryBeat(
  bookId: string,
  id: string,
  data: { title?: string; summary?: string }
) {
  await db
    .update(storyBeats)
    .set({ title: data.title, summary: data.summary })
    .where(and(eq(storyBeats.id, id), eq(storyBeats.bookId, bookId)));
}

/* ----------------------- Book meta / matter (Fase A5) ----------------------- */

export async function getBookMeta(bookId: string) {
  const rows = await db
    .select()
    .from(bookMeta)
    .where(eq(bookMeta.bookId, bookId))
    .limit(1);
  return rows[0] ?? null;
}

export async function saveBookMatter(bookId: string, matter: unknown) {
  await db
    .insert(bookMeta)
    .values({ bookId, matter })
    .onConflictDoUpdate({ target: bookMeta.bookId, set: { matter } });
}

/* ----------------------- Capa (FERRAMENTA_CAPA) ----------------------- */

export type CoverData = typeof covers.$inferInsert;

export async function getCover(bookId: string) {
  const rows = await db
    .select()
    .from(covers)
    .where(eq(covers.bookId, bookId))
    .limit(1);
  return rows[0] ?? null;
}

/** Cria/atualiza a capa do livro (1:1). `data` traz só os campos a mudar. */
export async function upsertCover(
  bookId: string,
  data: Partial<Omit<CoverData, "id" | "bookId">>
) {
  const rows = await db
    .insert(covers)
    .values({ bookId, ...data })
    .onConflictDoUpdate({
      target: covers.bookId,
      set: { ...data, updatedAt: new Date() },
    })
    .returning();
  return rows[0];
}

/* ----------------------- Bíblia da História (Fase A) ----------------------- */

export type BibleType =
  | "character"
  | "location"
  | "world_rule"
  | "timeline"
  | "glossary";

export async function getBible(bookId: string) {
  const [chars, locs, rules, tl, gloss] = await Promise.all([
    db.select().from(characters).where(eq(characters.bookId, bookId)),
    db.select().from(locations).where(eq(locations.bookId, bookId)),
    db.select().from(worldRules).where(eq(worldRules.bookId, bookId)),
    db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.bookId, bookId))
      .orderBy(timelineEvents.order),
    db.select().from(glossaryTerms).where(eq(glossaryTerms.bookId, bookId)),
  ]);
  return { characters: chars, locations: locs, worldRules: rules, timeline: tl, glossary: gloss };
}

export async function insertBibleEntry(
  bookId: string,
  type: BibleType,
  data: Record<string, string>
) {
  if (type === "character") {
    const r = await db
      .insert(characters)
      .values({
        bookId,
        name: data.name,
        role: data.role || null,
        appearance: data.appearance || null,
        traits: data.traits || null,
        arc: data.arc || null,
      })
      .returning();
    return r[0];
  }
  if (type === "location") {
    const r = await db
      .insert(locations)
      .values({ bookId, name: data.name, description: data.description || null })
      .returning();
    return r[0];
  }
  if (type === "world_rule") {
    const r = await db
      .insert(worldRules)
      .values({ bookId, category: data.category || null, rule: data.rule })
      .returning();
    return r[0];
  }
  if (type === "timeline") {
    const r = await db
      .insert(timelineEvents)
      .values({ bookId, description: data.description, order: Number(data.order) || 0 })
      .returning();
    return r[0];
  }
  const r = await db
    .insert(glossaryTerms)
    .values({ bookId, term: data.term, definition: data.definition })
    .returning();
  return r[0];
}

export async function deleteBibleEntry(
  bookId: string,
  type: BibleType,
  id: string
) {
  const table =
    type === "character"
      ? characters
      : type === "location"
        ? locations
        : type === "world_rule"
          ? worldRules
          : type === "timeline"
            ? timelineEvents
            : glossaryTerms;
  await db.delete(table).where(and(eq(table.id, id), eq(table.bookId, bookId)));
}

/* ----------------------- Capítulos (Fase 4) ----------------------- */

export async function getChapters(bookId: string) {
  return db
    .select()
    .from(chapters)
    .where(eq(chapters.bookId, bookId))
    .orderBy(chapters.index);
}

export async function createChapter(
  bookId: string,
  index: number,
  title: string
) {
  const rows = await db
    .insert(chapters)
    .values({ bookId, index, title, status: "generating" })
    .returning();
  return rows[0];
}

export async function completeChapter(
  id: string,
  data: {
    contentJson: unknown;
    contentText: string;
    tokensUsed: number;
    summary?: string;
  }
) {
  await db
    .update(chapters)
    .set({
      contentJson: data.contentJson,
      contentText: data.contentText,
      tokensUsed: data.tokensUsed,
      ...(data.summary ? { summary: data.summary } : {}),
      status: "review",
      updatedAt: new Date(),
    })
    .where(eq(chapters.id, id));
}

export async function updateChapterContent(
  chapterId: string,
  userId: string,
  data: { contentJson: unknown; contentText: string }
) {
  // Posse: só atualiza capítulos cujo livro pertence ao usuário.
  const ownedBooks = db
    .select({ id: books.id })
    .from(books)
    .where(eq(books.ownerId, userId));

  const rows = await db
    .update(chapters)
    .set({
      contentJson: data.contentJson,
      contentText: data.contentText,
      updatedAt: new Date(),
    })
    .where(and(eq(chapters.id, chapterId), inArray(chapters.bookId, ownedBooks)))
    .returning({ id: chapters.id });

  return rows[0] ?? null;
}

export async function setBookStatus(
  bookId: string,
  userId: string,
  status: BookStatus
) {
  await db
    .update(books)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(books.id, bookId), eq(books.ownerId, userId)));
}

/**
 * Base compartilhada de palavras-chave. Dedup em duas etapas por categoria:
 *   1) EXATO (case-insensitive) — barato, pega digitação idêntica;
 *   2) SEMÂNTICO (pgvector, cosine) — pega sinônimos/variações via embedding Voyage.
 * Se encontra duplicata, incrementa usage_count; senão insere (com embedding).
 * Sem VOYAGE_API_KEY, só a etapa exata roda (embedText retorna null).
 */
export async function upsertKeyword(
  userId: string,
  category: KeywordCategoryKey,
  value: string
) {
  const v = value.trim();
  if (!v) return;

  // 1) Dedup exato
  const exact = await db
    .select({ id: keywords.id })
    .from(keywords)
    .where(
      and(
        eq(keywords.category, category),
        sql`lower(${keywords.value}) = lower(${v})`
      )
    )
    .limit(1);
  if (exact.length) {
    await incrementKeyword(exact[0].id);
    return;
  }

  // 2) Dedup semântico (se houver embedding)
  const vec = await embedText(v);
  if (vec) {
    const distance = cosineDistance(keywords.embedding, vec);
    const near = await db
      .select({ id: keywords.id, distance })
      .from(keywords)
      .where(and(eq(keywords.category, category), isNotNull(keywords.embedding)))
      .orderBy(distance)
      .limit(1);
    if (near.length && Number(near[0].distance) < SEMANTIC_DEDUP_THRESHOLD) {
      await incrementKeyword(near[0].id);
      return;
    }
  }

  await db.insert(keywords).values({
    category,
    value: v,
    createdBy: userId,
    embedding: vec ?? undefined,
  });
}

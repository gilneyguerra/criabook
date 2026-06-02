import { and, cosineDistance, desc, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { books, keywords } from "@/lib/db/schema";
import { embedText } from "@/lib/ai/embeddings";
import type { KeywordCategoryKey } from "@/lib/keywords";

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
    .select()
    .from(books)
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
  data: { title?: string; genre?: string; brief: unknown }
) {
  const rows = await db
    .update(books)
    .set({
      title: data.title,
      genre: data.genre,
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

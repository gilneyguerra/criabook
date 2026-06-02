import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { books, keywords } from "@/lib/db/schema";
import type { KeywordCategoryKey } from "@/lib/keywords";

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

/**
 * Base compartilhada de palavras-chave. Dedup EXATO (case-insensitive) por
 * categoria: se já existe, incrementa usage_count; senão insere.
 * (Dedup SEMÂNTICO via pgvector fica para quando definirmos o provedor de embeddings.)
 */
export async function upsertKeyword(
  userId: string,
  category: KeywordCategoryKey,
  value: string
) {
  const v = value.trim();
  if (!v) return;

  const existing = await db
    .select({ id: keywords.id })
    .from(keywords)
    .where(
      and(
        eq(keywords.category, category),
        sql`lower(${keywords.value}) = lower(${v})`
      )
    )
    .limit(1);

  if (existing.length) {
    await db
      .update(keywords)
      .set({ usageCount: sql`${keywords.usageCount} + 1` })
      .where(eq(keywords.id, existing[0].id));
  } else {
    await db
      .insert(keywords)
      .values({ category, value: v, createdBy: userId });
  }
}

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";

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

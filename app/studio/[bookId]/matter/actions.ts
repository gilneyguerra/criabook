"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getBookForUser, saveBookMatter } from "@/lib/db/queries";
import type { Matter } from "@/lib/matter";

export async function saveMatter(bookId: string, matter: Matter) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };

  await saveBookMatter(bookId, matter);
  return { ok: true };
}

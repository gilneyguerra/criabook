"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  getBookForUser,
  insertBibleEntry,
  deleteBibleEntry,
  type BibleType,
} from "@/lib/db/queries";
import {
  indexBibleEntry,
  removeBibleEntry,
  type RagSourceType,
} from "@/lib/ai/rag";

function ragSource(type: BibleType): RagSourceType | null {
  return type === "timeline" ? null : (type as RagSourceType);
}

function entryText(type: BibleType, d: Record<string, string>): string {
  if (type === "character")
    return [
      d.name,
      d.role && `(${d.role})`,
      d.appearance && `Aparência: ${d.appearance}`,
      d.traits && `Traços: ${d.traits}`,
      d.arc && `Arco: ${d.arc}`,
    ]
      .filter(Boolean)
      .join(". ");
  if (type === "location") return [d.name, d.description].filter(Boolean).join(". ");
  if (type === "world_rule")
    return `Regra${d.category ? ` (${d.category})` : ""}: ${d.rule}`;
  if (type === "timeline") return `Evento: ${d.description}`;
  return `${d.term}: ${d.definition}`;
}

export async function addBibleEntry(
  bookId: string,
  type: BibleType,
  data: Record<string, string>
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };

  const row = await insertBibleEntry(bookId, type, data);
  const rs = ragSource(type);
  if (rs && row) {
    try {
      await indexBibleEntry(bookId, rs, row.id, entryText(type, data));
    } catch {}
  }
  return { ok: true };
}

export async function removeBibleEntryAction(
  bookId: string,
  type: BibleType,
  id: string
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };

  await deleteBibleEntry(bookId, type, id);
  const rs = ragSource(type);
  if (rs) {
    try {
      await removeBibleEntry(bookId, rs, id);
    } catch {}
  }
  return { ok: true };
}

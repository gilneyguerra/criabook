import { and, cosineDistance, eq, isNotNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { ragChunks } from "@/lib/db/schema";
import { embedText } from "@/lib/ai/embeddings";
import { getAnthropic, MODEL_FAST } from "@/lib/ai/claude";

export type RagSourceType =
  | "chapter"
  | "character"
  | "location"
  | "world_rule"
  | "glossary";

/** Resumo de 1 parágrafo de um capítulo (Haiku). "" sem API key. */
export async function summarizeChapter(text: string): Promise<string> {
  const anthropic = getAnthropic();
  if (!anthropic || !text.trim()) return "";
  try {
    const res = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 300,
      system:
        "Resuma o capítulo em UM parágrafo objetivo (3 a 5 frases), em pt-BR, " +
        "citando personagens, locais e o que avançou na trama. Responda só o resumo.",
      messages: [{ role: "user", content: text.slice(0, 12000) }],
    });
    const block = res.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text.trim() : "";
  } catch {
    return "";
  }
}

function chunkText(text: string, size = 1000): string[] {
  const paras = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && (cur + "\n\n" + p).length > size) {
      chunks.push(cur);
      cur = p;
    } else {
      cur = cur ? cur + "\n\n" + p : p;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

async function deleteChunks(
  bookId: string,
  sourceType: RagSourceType,
  sourceId: string
) {
  await db
    .delete(ragChunks)
    .where(
      and(
        eq(ragChunks.bookId, bookId),
        eq(ragChunks.sourceType, sourceType),
        eq(ragChunks.sourceId, sourceId)
      )
    );
}

/** Reindexa um capítulo: apaga chunks antigos e insere novos (com embedding). */
export async function indexChapter(
  bookId: string,
  chapterId: string,
  text: string
) {
  await deleteChunks(bookId, "chapter", chapterId);
  for (const chunk of chunkText(text)) {
    const vec = await embedText(chunk);
    await db.insert(ragChunks).values({
      bookId,
      sourceType: "chapter",
      sourceId: chapterId,
      chunkText: chunk,
      embedding: vec ?? undefined,
    });
  }
}

/** Indexa (ou reindexa) uma entry da Bíblia como um único chunk. */
export async function indexBibleEntry(
  bookId: string,
  sourceType: RagSourceType,
  sourceId: string,
  text: string
) {
  await deleteChunks(bookId, sourceType, sourceId);
  if (!text.trim()) return;
  const vec = await embedText(text);
  await db.insert(ragChunks).values({
    bookId,
    sourceType,
    sourceId,
    chunkText: text.trim(),
    embedding: vec ?? undefined,
  });
}

export async function removeBibleEntry(
  bookId: string,
  sourceType: RagSourceType,
  sourceId: string
) {
  await deleteChunks(bookId, sourceType, sourceId);
}

/** Recupera os top-k chunks mais próximos da query (cosine). [] sem embeddings. */
export async function retrieveContext(
  bookId: string,
  query: string,
  k = 5
): Promise<string[]> {
  const vec = await embedText(query);
  if (!vec) return [];
  const distance = cosineDistance(ragChunks.embedding, vec);
  const rows = await db
    .select({ chunkText: ragChunks.chunkText, distance })
    .from(ragChunks)
    .where(and(eq(ragChunks.bookId, bookId), isNotNull(ragChunks.embedding)))
    .orderBy(distance)
    .limit(k);
  return rows.map((r) => r.chunkText);
}

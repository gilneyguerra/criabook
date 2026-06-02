/**
 * Embeddings via Voyage AI (parceiro de embeddings da Anthropic).
 * Usa fetch direto (sem SDK). Retorna null sem VOYAGE_API_KEY — assim o
 * dedup semântico degrada para dedup exato sem quebrar nada.
 *
 * voyage-3.5-lite com output_dimension=1024 (casa com a coluna vector(1024)).
 */

export const EMBEDDING_DIMENSIONS = 1024;
const VOYAGE_MODEL = process.env.VOYAGE_MODEL ?? "voyage-3.5-lite";

export async function embedText(text: string): Promise<number[] | null> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) return null;

  const value = text.trim();
  if (!value) return null;

  try {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: VOYAGE_MODEL,
        input: [value],
        input_type: "document",
        output_dimension: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const embedding = data?.data?.[0]?.embedding;
    return Array.isArray(embedding) ? (embedding as number[]) : null;
  } catch {
    return null;
  }
}

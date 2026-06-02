/**
 * Templates de prompt para a IA (Claude).
 * Fase 3: sugestões de palavras-chave (Haiku).
 * Fase 4 (depois): estrutura/roadmap, capítulo (brief + resumo dos anteriores),
 * e resumo comprimido — placeholders documentados abaixo.
 */

export const KEYWORD_SYSTEM =
  "Você é um assistente de escrita criativa em português do Brasil. " +
  "Gere palavras-chave curtas, evocativas e variadas para ajudar a construir " +
  "a base de um livro. Responda sempre em pt-BR, sem numeração nem explicações.";

export function buildKeywordPrompt(
  categoryLabel: string,
  count: number,
  context?: string
): string {
  return [
    `Categoria: ${categoryLabel}.`,
    context ? `Contexto do livro até agora: ${context}.` : "",
    `Liste ${count} sugestões curtas (1 a 3 palavras cada), diversas e originais ` +
      `para esta categoria. Evite repetições e clichês óbvios.`,
  ]
    .filter(Boolean)
    .join("\n");
}

// --- Fase 4: geração de capítulo ---

import { KEYWORD_CATEGORIES } from "@/lib/keywords";

/** Converte o book_brief (seleções por categoria) em texto para o prompt. */
export function briefToText(
  brief: Record<string, string[]> | null | undefined,
  title?: string | null
): string {
  const parts: string[] = [];
  if (title) parts.push(`Título: ${title}`);
  for (const c of KEYWORD_CATEGORIES) {
    const values = brief?.[c.key] ?? [];
    if (values.length) parts.push(`${c.label}: ${values.join(", ")}`);
  }
  return parts.join("\n") || "Sem base definida.";
}

export function buildChapterSystem(briefText: string): string {
  return (
    "Você é um escritor profissional de ficção em português do Brasil. " +
    "Escreva prosa imersiva, com ritmo, diálogos naturais e descrições vívidas. " +
    "Mantenha total coerência com a base do livro abaixo:\n\n" +
    briefText +
    "\n\nResponda APENAS com o texto do capítulo — sem título, sem cabeçalhos, " +
    "sem listas, sem comentários ou metadados."
  );
}

export function buildChapterPrompt(index: number, prevContext?: string): string {
  return [
    `Escreva o Capítulo ${index} do livro.`,
    prevContext
      ? `Resumo do que aconteceu até aqui (para manter a continuidade):\n${prevContext}`
      : "Este é o primeiro capítulo — estabeleça o tom, a ambientação e o protagonista.",
    "Extensão: cerca de 700 a 1000 palavras, em parágrafos separados por linha em branco. " +
      "Termine em um gancho que dê vontade de continuar.",
  ].join("\n\n");
}

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

// --- Fase 4 (placeholders) ---
// export function buildStructurePrompt(brief) { ... }   // gera os story_beats
// export function buildChapterPrompt(brief, roadmap, prevSummaries) { ... }
// export function buildSummaryPrompt(chapterText) { ... } // comprime p/ contexto

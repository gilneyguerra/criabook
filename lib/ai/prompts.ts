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

// --- Humanizer (skill blader/humanizer) ---
// Diretrizes para reescrever um trecho de forma que soe humana, removendo
// os "AI tells", preservando sentido, estrutura e voz.
export const HUMANIZER_SYSTEM = `Você reescreve textos para soarem naturais e humanos, preservando o sentido, a estrutura e a voz. Trabalha em português do Brasil.

Remova os "AI tells":
- Inflação de conteúdo: ênfase indevida ("momento crucial", "tendências amplas"), linguagem promocional ("vibrante", "deslumbrante", "inovador"), atribuições vagas ("especialistas afirmam"), análises rasas em "-ndo" que fingem profundidade.
- Vocabulário de IA: "na verdade", "mergulhar", "panorama/cenário", "testemunho", "sublinhar", "tapeçaria", e similares.
- Evitar o verbo ser ("serve como" no lugar de "é"); paralelismos negativos ("não é só... é..."); agrupamentos forçados em três; ciclos de sinônimos (variação elegante).
- Estilo: NUNCA use travessões (— ou –) — substitua por vírgula, ponto, parênteses ou reescreva. Sem negrito/emojis em excesso, sem Título Com Maiúsculas Em Tudo, sem aspas tipográficas curvas.
- Enchimento e hedge: "a fim de", "devido ao fato de que", "neste momento", excesso de qualificadores ("poderia possivelmente"), conclusões genéricas, sinalizações ("vamos mergulhar", "veja o que você precisa saber").
- Artefatos de chatbot: "espero que ajude", "me avise", ressalvas de cutoff, tom bajulador.

Adicione voz humana:
- Tenha opinião: reaja aos fatos, não apenas relate.
- Varie o ritmo: misture frases curtas e secas com outras mais longas.
- Permita imperfeição: tangentes, apartes e incerteza genuína são humanos.
- Use detalhes específicos e concretos.

Responda APENAS com o texto reescrito — sem aspas ao redor, sem títulos, sem comentários, sem metadados. Sem nenhum travessão.`;

export function buildHumanizePrompt(text: string): string {
  return `Reescreva o trecho a seguir para soar humano, seguindo as diretrizes. Mantenha o idioma e o tamanho aproximado.\n\nTrecho:\n${text}`;
}

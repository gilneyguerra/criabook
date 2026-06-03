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

/** Preset de estilo por gênero/tipo (Fase B) — vira diretriz no system prompt. */
export function genreEmphasis(
  genre?: string | null,
  type?: string | null
): string {
  if (type === "nonfiction")
    return "Clareza acima de tudo, estrutura lógica, exemplos concretos e passos acionáveis.";
  const g = (genre ?? "").toLowerCase();
  if (/(thriller|suspense|polic|terror)/.test(g))
    return "Ritmo seco, frases curtas, tensão crescente e gancho no fim de cada cena.";
  if (/(fantasia|fic[çc][ãa]o cient|sci|distop)/.test(g))
    return "Densidade descritiva, worldbuilding coerente; respeite as regras do mundo da Bíblia.";
  if (/(romance|drama)/.test(g))
    return "Emoção, tensão relacional e diálogos vivos; mostre os sentimentos, não os explique.";
  return "Prosa imersiva e equilibrada, com ritmo variado.";
}

/** Contexto editorial completo do livro (camada de ofício) para o system prompt. */
export function bookContextText(book: {
  title?: string | null;
  type?: string | null;
  logline?: string | null;
  genre?: string | null;
  audience?: string | null;
  pov?: string | null;
  tone?: string | null;
  structureMethod?: string | null;
  brief?: Record<string, string[]> | null;
}): string {
  const isNon = book.type === "nonfiction";
  const parts: string[] = [];
  if (book.title) parts.push(`Título: ${book.title}`);
  parts.push(`Tipo: ${isNon ? "não-ficção" : "ficção"}`);
  if (book.logline)
    parts.push(`${isNon ? "Transformação prometida" : "Logline"}: ${book.logline}`);
  if (book.genre) parts.push(`Gênero: ${book.genre}`);
  if (book.audience) parts.push(`Público-alvo: ${book.audience}`);
  if (book.pov) parts.push(`POV: ${book.pov}`);
  if (book.tone) parts.push(`Tom: ${book.tone}`);
  if (book.structureMethod) parts.push(`Estrutura: ${book.structureMethod}`);
  const kw = briefToText(book.brief ?? null);
  if (kw && kw !== "Sem base definida.") parts.push(kw);
  parts.push(`Diretriz de estilo: ${genreEmphasis(book.genre, book.type)}`);
  return parts.join("\n") || "Sem base definida.";
}

// Motor de consistência (REGRAS_CONSISTENCIA §9) — disciplina de grounding,
// injetada no system prompt junto do Contexto Ancorado. Os marcadores
// [LACUNA:…] e [NOVO_FATO:…] são o elo com o pipeline de extração/verificação.
export const GROUNDING_SYSTEM = `Os blocos de contexto acima são a ÚNICA fonte de verdade (CÂNONE, ESTADO_ATUAL, TIMELINE, CONHECIMENTO, DESCRITOS, EVITAR_ABERTURAS, FIOS_ABERTOS, BEAT_ATUAL).

GROUNDING (não alucinar):
- Use SOMENTE fatos presentes nos blocos. Não invente nomes, datas, lugares, parentescos, objetos, eventos ou regras que não estejam ali.
- Se um fato necessário não existir no contexto, NÃO invente: escreva o marcador [LACUNA: o que falta] e contorne. Nunca apresente suposição como fato.
- NÃO altere fatos já estabelecidos (aparência, idade, relações, regras do mundo).
- Ao introduzir um fato novo e durável (nome, lugar, regra, objeto relevante), marque-o com [NOVO_FATO: descrição] para registro no cânone.

TIMELINE E CONHECIMENTO (coerência):
- Respeite a cronologia de TIMELINE. Não contradiga o que já aconteceu nem antecipe o que ainda não aconteceu. Mantenha estação, hora, idade e deslocamentos coerentes.
- Cada personagem só sabe e só age com base no que consta em CONHECIMENTO até este capítulo. Personagem morto ou ausente não atua (exceto flashback explicitamente marcado).

ANTI-REPETIÇÃO:
- NÃO re-descreva por extenso nada que esteja em DESCRITOS — referencie em poucas palavras.
- Varie aberturas de parágrafo e de capítulo; evite as listadas em EVITAR_ABERTURAS. Não reexplique o que já foi narrado ("como sabemos…"); avance a história.

ELABORAÇÃO:
- Desenvolva a partir de BEAT_ATUAL e avance pelo menos um item de FIOS_ABERTOS. Mantenha o POV, o tempo verbal e o tom do projeto.`;

export function buildChapterSystem(briefText: string): string {
  return (
    "Você é um escritor profissional de ficção em português do Brasil. " +
    "Escreva prosa imersiva, com ritmo, diálogos naturais e descrições vívidas. " +
    "Use a tipografia padrão do português: diálogos com travessão (—) no início " +
    "da fala, aspas curvas (“ ”) só para citações/pensamentos, reticências (…). " +
    "Não embuta formatação visual (sem recuos manuais, sem espaços duplos).\n\n" +
    "PARÁGRAFOS (tipografia de livro):\n" +
    "- Uma ideia por parágrafo. Comece um NOVO parágrafo quando o foco muda: nova " +
    "ação, novo assunto, mudança de tempo ou de lugar, ou troca de quem fala.\n" +
    "- Diálogo: cada fala de um interlocutor diferente é um novo parágrafo, " +
    "iniciado por travessão (—).\n" +
    "- Varie o comprimento dos parágrafos (curtos e longos) para criar ritmo; " +
    "evite blocos uniformes.\n" +
    "- Ao MUDAR de cena ou de assunto dentro do capítulo, insira uma linha " +
    "contendo APENAS '* * *' (quebra de cena), com parcimônia. Em não-ficção, " +
    "use um subtítulo de seção em uma linha iniciada por '## '.\n" +
    "- Separe parágrafos por UMA linha em branco; o recuo/espaçamento é aplicado " +
    "na diagramação, não no texto.\n\n" +
    briefText +
    "\n\n" +
    GROUNDING_SYSTEM +
    "\n\nResponda APENAS com o texto do capítulo — sem título, sem cabeçalhos, " +
    "sem listas, sem comentários ou metadados. Os marcadores [LACUNA:…] e " +
    "[NOVO_FATO:…] podem aparecer inline quando aplicável."
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

export function buildContinuePrompt(tail: string, index?: number): string {
  const t = tail.trim();
  if (!t) {
    // Capítulo vazio: escrever a ABERTURA avançando a história (sem repetir nada).
    return [
      `Escreva a ABERTURA do Capítulo ${index ?? ""} a partir do ESTADO_ATUAL e do BEAT_ATUAL do contexto.`,
      "AVANCE a história com fatos NOVOS — não recapitule nem repita capítulos anteriores.",
      "Escreva de 400 a 700 palavras, em parágrafos separados por linha em branco. Termine num gancho.",
    ].join("\n\n");
  }
  return [
    "Abaixo está o FINAL do texto já escrito deste capítulo (apenas para você emendar).",
    "Continue EXATAMENTE a partir da última frase, escrevendo SOMENTE texto NOVO que dá sequência à história. " +
      "NUNCA repita, reescreva, resuma ou copie o que está abaixo — nem trechos de capítulos anteriores.",
    "Mantenha o mesmo tom, tempo verbal e POV. Escreva de 400 a 700 palavras, em parágrafos separados por linha em branco.",
    "--- FINAL DO TEXTO ATUAL (continue daqui) ---\n" + t,
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
- Estilo (PT-BR): NÃO use travessão como muleta de pausa/aparte na NARRAÇÃO — prefira vírgula, ponto ou parênteses. MAS o travessão (—) é OBRIGATÓRIO no DIÁLOGO em português: preserve-o no início das falas e antes do verbo de elocução. Aspas curvas (“ ” ‘ ’) são a tipografia correta em PT-BR — mantenha-as. Sem negrito/emojis em excesso, sem Título Com Maiúsculas Em Tudo.
- Enchimento e hedge: "a fim de", "devido ao fato de que", "neste momento", excesso de qualificadores ("poderia possivelmente"), conclusões genéricas, sinalizações ("vamos mergulhar", "veja o que você precisa saber").
- Artefatos de chatbot: "espero que ajude", "me avise", ressalvas de cutoff, tom bajulador.

Adicione voz humana:
- Tenha opinião: reaja aos fatos, não apenas relate.
- Varie o ritmo: misture frases curtas e secas com outras mais longas.
- Permita imperfeição: tangentes, apartes e incerteza genuína são humanos.
- Use detalhes específicos e concretos.

Responda APENAS com o texto reescrito, sem títulos, sem comentários, sem metadados. Preserve a pontuação de diálogo em PT-BR (travessão) e as aspas curvas.`;

export function buildHumanizePrompt(text: string): string {
  return `Reescreva o trecho a seguir para soar humano, seguindo as diretrizes. Mantenha o idioma e o tamanho aproximado.\n\nTrecho:\n${text}`;
}

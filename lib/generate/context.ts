/**
 * Contexto Ancorado (REGRAS_CONSISTENCIA §4) — o laço PREVENTIVO.
 *
 * Híbrido > RAG puro: injeta de forma DETERMINÍSTICA o cânone/estado/timeline/
 * conhecimento/fios da cena (previne alucinação de modo confiável) e usa o RAG
 * só como complemento. Tudo com orçamento de tokens: o estado estruturado é
 * compacto, então livros longos cabem sem reler o texto inteiro.
 *
 * Retorna { briefText, prevContext }: briefText vai ao system (com os blocos
 * que o GROUNDING_SYSTEM referencia); prevContext (RAG) vai ao prompt do user.
 */

import { bookContextText } from "@/lib/ai/prompts";
import { retrieveContext } from "@/lib/ai/rag";
import { getBible, getStoryBeats } from "@/lib/db/queries";
import {
  getActiveCanonFacts,
  getCharacterKnowledge,
  getOpenThreads,
  getDescribedItems,
  getTimelineEvents,
} from "@/lib/memory/ledgers";
import { getRollingSummaryBefore } from "@/lib/memory/state";

type BookRow = {
  title: string | null;
  type: string | null;
  logline: string | null;
  genre: string | null;
  audience: string | null;
  pov: string | null;
  tone: string | null;
  structureMethod: string | null;
  brief: unknown;
};

type ChapterRow = { id?: string; index: number; contentText: string | null };

function firstWords(text: string, n = 8): string {
  return text.trim().split(/\s+/).slice(0, n).join(" ");
}

function block(title: string, lines: string[]): string {
  const items = lines.filter(Boolean);
  return items.length ? `${title}:\n${items.map((l) => `- ${l}`).join("\n")}` : "";
}

/**
 * Monta o Contexto Ancorado para gerar o capítulo `index`.
 */
export async function buildAnchoredContext(
  bookId: string,
  book: BookRow,
  index: number,
  chapters: ChapterRow[]
): Promise<{ briefText: string; prevContext?: string }> {
  const base = bookContextText({
    title: book.title,
    type: book.type,
    logline: book.logline,
    genre: book.genre,
    audience: book.audience,
    pov: book.pov,
    tone: book.tone,
    structureMethod: book.structureMethod,
    brief: book.brief as Record<string, string[]>,
  });

  const [facts, knowledge, threads, described, timeline, bible, beats, rolling] =
    await Promise.all([
      getActiveCanonFacts(bookId).catch(() => []),
      getCharacterKnowledge(bookId).catch(() => []),
      getOpenThreads(bookId).catch(() => []),
      getDescribedItems(bookId).catch(() => []),
      getTimelineEvents(bookId).catch(() => []),
      getBible(bookId).catch(() => null),
      getStoryBeats(bookId).catch(() => []),
      getRollingSummaryBefore(bookId, index).catch(() => ""),
    ]);

  // Escopo por POSIÇÃO: gerar/continuar o capítulo `index` só enxerga o estado
  // estabelecido nos capítulos ANTERIORES (< index). Nunca lê o "futuro".
  const canon = block(
    "CÂNONE (fatos estabelecidos — não contradiga)",
    facts
      .filter((f) => f.establishedInChapter < index)
      .slice(0, 40)
      .map((f) => `${f.subject} · ${f.attribute}: ${f.value} (cap. ${f.establishedInChapter})`)
  );

  const rules = block(
    "REGRAS DO MUNDO",
    (bible?.worldRules ?? []).slice(0, 20).map((r) => r.rule)
  );

  const chars = block(
    "PERSONAGENS (Bíblia)",
    (bible?.characters ?? [])
      .slice(0, 20)
      .map((c) =>
        `${c.name}${c.role ? ` (${c.role})` : ""}: ${[c.appearance, c.traits].filter(Boolean).join("; ")}`.trim()
      )
  );

  const know = block(
    "CONHECIMENTO (quem sabe o quê)",
    knowledge
      .filter((k) => k.learnedInChapter < index)
      .slice(0, 30)
      .map((k) => `${k.character} sabe: ${k.fact} (desde cap. ${k.learnedInChapter})`)
  );

  const open = block(
    "FIOS_ABERTOS (avance ao menos um)",
    threads
      .filter((t) => t.openedInChapter < index)
      .slice(0, 20)
      .map((t) => `${t.description} (aberto cap. ${t.openedInChapter})`)
  );

  const desc = block(
    "DESCRITOS (referencie, NÃO re-descreva)",
    described
      .filter((d) => d.describedInChapter < index)
      .slice(0, 30)
      .map((d) => `${d.subject} (cap. ${d.describedInChapter})`)
  );

  const openings = block(
    "EVITAR_ABERTURAS (não repita estes inícios)",
    chapters
      .filter((c) => c.index < index)
      .slice(-6)
      .map((c) => (c.contentText ? `"${firstWords(c.contentText)}…"` : ""))
  );

  const tl = block(
    "TIMELINE (tempo da história)",
    timeline
      .filter((e) => e.chapterRef == null || e.chapterRef < index)
      .slice(0, 30)
      .map(
        (e) =>
          `${e.storyTime ? `[${e.storyTime}] ` : ""}${e.description}${e.chapterRef ? ` (narrado cap. ${e.chapterRef})` : ""}`
      )
  );

  // BEAT_ATUAL: beat correspondente ao capítulo (por ordem).
  const beat = beats.find((b) => b.order === index) ?? beats[index - 1];
  const beatBlock = beat
    ? `BEAT_ATUAL: ${beat.title ?? ""}${beat.summary ? ` — ${beat.summary}` : ""}`
    : "";

  const stateBlock = rolling
    ? `ESTADO_ATUAL (resumo da história até aqui):\n${rolling}`
    : "";

  const briefText = [
    base,
    canon,
    rules,
    chars,
    know,
    tl,
    desc,
    openings,
    open,
    beatBlock,
    stateBlock,
  ]
    .filter(Boolean)
    .join("\n\n");

  // RAG: complemento por similaridade (vai no prompt do user). Exclui os
  // capítulos do "futuro" (índice ≥ alvo) e a versão antiga do próprio capítulo.
  const excludeSourceIds = chapters
    .filter((c) => c.index >= index && c.id)
    .map((c) => c.id as string);
  const retrieved = await retrieveContext(
    bookId,
    `${book.logline ?? book.title ?? ""}\nCapítulo ${index}`,
    5,
    { excludeSourceIds }
  ).catch(() => [] as string[]);
  const prevContext = retrieved.length
    ? `Trechos relevantes recuperados (capítulos/Bíblia):\n${retrieved.join("\n---\n")}`
    : undefined;

  return { briefText, prevContext };
}

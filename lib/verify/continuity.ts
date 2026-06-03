/**
 * Laço DETECTOR (REGRAS_CONSISTENCIA §5). Monta o contexto de verificação a
 * partir dos LEDGERS (fonte de verdade determinística) + Bíblia + resumos dos
 * capítulos e confronta via Claude, transformando "parece coerente?" em
 * "contradiz algum fato registrado?". Retorna issues tipadas com proveniência.
 */

import { checkConsistency, type ConsistencyIssue } from "@/lib/ai/claude";
import { getBible, getChapters } from "@/lib/db/queries";
import {
  getActiveCanonFacts,
  getCharacterKnowledge,
  getTimelineEvents,
  getOpenThreads,
} from "@/lib/memory/ledgers";

function section(title: string, lines: string[]): string {
  const items = lines.filter(Boolean);
  return items.length ? `${title}:\n${items.map((l) => `- ${l}`).join("\n")}` : "";
}

/** Monta o contexto do detector (ledgers + Bíblia + resumos). */
export async function buildDetectorContext(bookId: string): Promise<string> {
  const [chapters, facts, knowledge, timeline, threads, bible] = await Promise.all([
    getChapters(bookId),
    getActiveCanonFacts(bookId).catch(() => []),
    getCharacterKnowledge(bookId).catch(() => []),
    getTimelineEvents(bookId).catch(() => []),
    getOpenThreads(bookId).catch(() => []),
    getBible(bookId).catch(() => null),
  ]);

  const canon = section(
    "CÂNONE (fatos verdadeiros)",
    facts.map((f) => `${f.subject} · ${f.attribute}: ${f.value} (cap. ${f.establishedInChapter})`)
  );
  const know = section(
    "CONHECIMENTO",
    knowledge.map((k) => `${k.character} sabe "${k.fact}" desde cap. ${k.learnedInChapter}`)
  );
  const tl = section(
    "TIMELINE",
    timeline.map((e) => `${e.storyTime ? `[${e.storyTime}] ` : ""}${e.description}${e.chapterRef ? ` (cap. ${e.chapterRef})` : ""}`)
  );
  const fios = section(
    "FIOS_ABERTOS (devem ser pagos antes do fim)",
    threads.map((t) => `${t.description} (aberto cap. ${t.openedInChapter})`)
  );
  const bibleBlock = bible
    ? [
        section(
          "PERSONAGENS",
          bible.characters.map((c) => `${c.name} (${c.role ?? ""}) ${c.appearance ?? ""} ${c.traits ?? ""}`.trim())
        ),
        section("REGRAS DO MUNDO", bible.worldRules.map((r) => r.rule)),
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const resumos = section(
    "RESUMOS DOS CAPÍTULOS (em ordem de narração)",
    chapters.map(
      (c) =>
        `Cap ${c.index} — ${c.title ?? ""}: ${c.summary ?? (c.contentText ?? "").slice(0, 400)}`
    )
  );

  return [canon, know, tl, fios, bibleBlock, resumos]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 16000);
}

/** Roda o detector e devolve as issues encontradas. */
export async function runContinuityCheck(
  bookId: string
): Promise<ConsistencyIssue[]> {
  const context = await buildDetectorContext(bookId);
  return checkConsistency(context);
}

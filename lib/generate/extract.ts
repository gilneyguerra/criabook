/**
 * Atualização de estado (REGRAS_CONSISTENCIA §2/§5) — após cada capítulo.
 *
 * Combina dois sinais: (1) extração por IA (Haiku) e (2) parse DETERMINÍSTICO
 * dos marcadores [NOVO_FATO:…] / [LACUNA:…] que o gerador emite. Persiste os
 * ledgers e grava um WorldStateSnapshot. Idempotente o bastante: re-gerar um
 * capítulo recria o snapshot daquele capítulo (os fatos são append; a limpeza
 * de duplicatas fica para a varredura da Fase 2).
 */

import { extractChapterState } from "@/lib/ai/claude";
import {
  addCanonFacts,
  addKnowledge,
  openThreads,
  addDescribedItems,
  addTimelineEvents,
  addIssues,
  clearChapterState,
} from "@/lib/memory/ledgers";
import {
  getRollingSummaryBefore,
  buildCumulativeSummary,
  saveWorldStateSnapshot,
} from "@/lib/memory/state";

/**
 * Remove os marcadores do texto e captura seu conteúdo.
 * - [NOVO_FATO: x] → registra x no cânone; some da prosa.
 * - [LACUNA: x] → vira issue soft (pendência ao autor); some da prosa.
 */
export function stripMarkers(text: string): {
  clean: string;
  novoFatos: string[];
  lacunas: string[];
} {
  const novoFatos: string[] = [];
  const lacunas: string[] = [];

  let clean = text.replace(/\[NOVO_FATO:\s*([^\]]+)\]/gi, (_m, g1) => {
    novoFatos.push(String(g1).trim());
    return "";
  });
  clean = clean.replace(/\[LACUNA:\s*([^\]]+)\]/gi, (_m, g1) => {
    lacunas.push(String(g1).trim());
    return "";
  });
  // Limpa espaços/linhas órfãs deixadas pela remoção.
  clean = clean
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { clean, novoFatos, lacunas };
}

/**
 * Persiste o estado extraído do capítulo `index`. `cleanText` já está
 * normalizado e sem marcadores. `markers`/`summary` vêm do pipeline da rota.
 * Best-effort: o chamador deve envolver em try/catch (não pode quebrar a geração).
 */
export async function persistExtraction(params: {
  bookId: string;
  index: number;
  cleanText: string;
  bookContext: string;
  novoFatos: string[];
  lacunas: string[];
  chapterSummary: string;
}): Promise<void> {
  const { bookId, index, cleanText, bookContext, novoFatos, lacunas, chapterSummary } =
    params;

  const ex = await extractChapterState(cleanText, bookContext);

  // Regeneração limpa: apaga o que ESTE capítulo havia registrado antes de
  // re-extrair (evita acúmulo/duplicatas e não herda o começo antigo). O
  // snapshot do mundo já é idempotente por capítulo (delete+insert).
  await clearChapterState(bookId, index).catch(() => {});

  // Fatos: extração estruturada + marcadores [NOVO_FATO] (atributo genérico).
  await addCanonFacts(bookId, [
    ...ex.facts.map((f) => ({
      subject: f.subject,
      attribute: f.attribute,
      value: f.value,
      establishedInChapter: index,
    })),
    ...novoFatos.map((v) => ({
      subject: "geral",
      attribute: "fato",
      value: v,
      establishedInChapter: index,
    })),
  ]).catch(() => {});

  await addKnowledge(
    bookId,
    ex.knowledge.map((k) => ({
      character: k.character,
      fact: k.fact,
      learnedInChapter: index,
    }))
  ).catch(() => {});

  await openThreads(
    bookId,
    ex.openedThreads.map((d) => ({ description: d, openedInChapter: index }))
  ).catch(() => {});

  await addDescribedItems(
    bookId,
    ex.describedSubjects.map((s) => ({ subject: s, describedInChapter: index }))
  ).catch(() => {});

  await addTimelineEvents(
    bookId,
    ex.events.map((e, i) => ({
      order: index * 100 + i, // storyOrder aproximado (ordem de narração)
      description: e.description,
      chapterRef: index,
      participants: e.participants,
      location: e.location ?? null,
      storyTime: e.storyTime ?? null,
    }))
  ).catch(() => {});

  // Lacunas → issues soft (pendência ao autor).
  if (lacunas.length) {
    await addIssues(
      bookId,
      lacunas.map((l) => ({
        chapter: index,
        type: "knowledge" as const,
        severity: "soft" as const,
        description: `Lacuna (dado faltante a confirmar): ${l}`,
        conflictsWith: null,
      }))
    ).catch(() => {});
  }

  // Atualiza o resumo rolante + snapshot do mundo ao fim do capítulo. Usa o
  // estado ANTERIOR a este capítulo (não o global) para não anexar a um resumo
  // que já inclua capítulos posteriores ao regerar um anterior.
  const prev = await getRollingSummaryBefore(bookId, index).catch(() => "");
  const summary = buildCumulativeSummary(prev, index, chapterSummary);
  await saveWorldStateSnapshot(bookId, index, summary, {
    openThreads: ex.openedThreads,
  }).catch(() => {});
}

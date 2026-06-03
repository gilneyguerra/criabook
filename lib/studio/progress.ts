/**
 * Progresso do fluxo de criação (FLUXO_E_UX §6). Calcula o "mínimo satisfeito"
 * de cada etapa para o indicador ✓/●/○ do header. Chamado no layout (server),
 * já autorizado pela sessão.
 */

import {
  getBookForUser,
  getBible,
  getStoryBeats,
  getChapters,
  getBookMeta,
  getCover,
} from "@/lib/db/queries";
import { getIssues } from "@/lib/memory/ledgers";
import type { Matter } from "@/lib/matter";

export type StepKey =
  | "base"
  | "cover"
  | "map"
  | "write"
  | "review"
  | "pages"
  | "export";

export type StudioProgress = Record<StepKey, boolean>;

const EMPTY: StudioProgress = {
  base: false,
  cover: false,
  map: false,
  write: false,
  review: false,
  pages: false,
  export: false,
};

export async function getStudioProgress(
  bookId: string,
  userId: string
): Promise<StudioProgress> {
  const book = await getBookForUser(bookId, userId).catch(() => null);
  if (!book) return EMPTY;

  const [bible, beats, chapters, meta, issues, cover] = await Promise.all([
    getBible(bookId).catch(() => null),
    getStoryBeats(bookId).catch(() => []),
    getChapters(bookId).catch(() => []),
    getBookMeta(bookId).catch(() => null),
    getIssues(bookId).catch(() => []),
    getCover(bookId).catch(() => null),
  ]);

  const hasBase =
    Boolean(book.logline?.trim()) &&
    Boolean(book.genre?.trim()) &&
    Boolean(book.layoutProfileId);
  const hasChar = (bible?.characters.length ?? 0) >= 1;
  const hasBeats = beats.length >= 1;
  const hasChapter = chapters.length >= 1;
  const openHard = issues.some(
    (i) => i.status === "open" && i.severity === "hard"
  );
  const author = ((meta?.matter ?? {}) as Matter).authorName?.trim();

  return {
    base: hasBase && hasChar,
    // Rascunho mínimo de capa: arte + título.
    cover: Boolean(cover?.frontArtUrl && cover?.title?.trim()),
    map: hasBeats,
    write: hasChapter,
    // Revisão "ok": há capítulos e nenhuma contradição hard aberta.
    review: hasChapter && !openHard,
    pages: Boolean(author),
    export: hasChapter && Boolean(author), // pronto para exportar
  };
}

/**
 * Paginação ESTIMADA (visão derivada). Calcula quantas palavras cabem numa
 * página a partir do Perfil de Layout (trim + margens + corpo + entrelinha) e
 * divide o texto dos capítulos em páginas, com numeração editorial:
 *   - pré-textuais: contadas, não exibidas (offset).
 *   - corpo: algarismos arábicos.
 *   - página de abertura de capítulo: número OCULTO (null) mas contado.
 *
 * É uma estimativa para navegação/numeração no app; a paginação exata acontece
 * no render do PDF (worker).
 */

import type { BookLayoutProfile } from "@/lib/layout/profile";
import { isImage } from "@/lib/tiptap";

const PT_TO_MM = 0.3528;

/** Palavras por página estimadas pelo Perfil de Layout. */
export function wordsPerPage(profile: BookLayoutProfile): number {
  const p = profile.print;
  const textWidthMm = Math.max(40, p.trim.widthMm - p.margins.outerMm - p.margins.gutterMm);
  const textHeightMm = Math.max(60, p.trim.heightMm - p.margins.topMm - p.margins.bottomMm);
  const lineHeightMm = p.bodySizePt * (p.leadingPct / 100) * PT_TO_MM;
  const linesPerPage = Math.max(1, Math.floor(textHeightMm / lineHeightMm));
  const avgCharWidthMm = p.bodySizePt * 0.5 * PT_TO_MM; // ~0,5em por caractere
  const charsPerLine = Math.max(1, Math.floor(textWidthMm / avgCharWidthMm));
  const wpp = Math.round((charsPerLine * linesPerPage) / 6); // ~6 chars/palavra
  return Math.min(500, Math.max(150, wpp));
}

function countWords(s: string): number {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
}

export type ChapterPage = {
  displayNumber: number | null; // null = oculto (abertura de capítulo)
  wordStart: number; // palavra de início dentro do capítulo (p/ scroll)
  preview: string;
};

export type ChapterPagination = { pages: ChapterPage[]; totalWords: number };

/** Divide o texto de um capítulo em "páginas" por limite de palavras. */
function splitChapter(text: string, wpp: number): { wordStart: number; preview: string }[] {
  const paragraphs = (text ?? "")
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const pages: { wordStart: number; preview: string }[] = [];
  let realRunning = 0; // índice REAL de palavras (p/ scroll)
  let fill = 0; // ocupação da página (imagem infla)
  let pageStart = 0;
  let pageHead = "";

  for (const para of paragraphs) {
    const img = isImage(para);
    const realW = countWords(para);
    // Uma ilustração ocupa ~meia página (e nunca é partida entre páginas).
    const fillW = img ? Math.round(wpp * 0.5) : realW;
    if (fill > 0 && fill + fillW > wpp) {
      pages.push({ wordStart: pageStart, preview: pageHead.slice(0, 50) });
      pageStart = realRunning;
      fill = 0;
      pageHead = "";
    }
    if (!pageHead) pageHead = img ? "🖼 ilustração" : para;
    fill += fillW;
    realRunning += realW;
  }
  if (fill > 0 || pages.length === 0) {
    pages.push({ wordStart: pageStart, preview: pageHead.slice(0, 50) });
  }
  return pages;
}

/**
 * Pagina o livro inteiro com numeração editorial. `frontMatterPages` é o nº de
 * páginas pré-textuais (contadas, não exibidas).
 */
export function paginateBook(
  chapters: { id: string; index: number; contentText: string | null }[],
  wpp: number,
  frontMatterPages: number
): Record<string, ChapterPagination> {
  const sorted = [...chapters].sort((a, b) => a.index - b.index);
  const out: Record<string, ChapterPagination> = {};
  let running = frontMatterPages; // última página numerada usada

  for (const c of sorted) {
    const text = c.contentText ?? "";
    const totalWords = countWords(text);
    const raw = text.trim() ? splitChapter(text, wpp) : [];
    const pages: ChapterPage[] = raw.map((pg, i) => {
      running += 1;
      return {
        displayNumber: i === 0 ? null : running, // abertura de capítulo: oculto
        wordStart: pg.wordStart,
        preview: pg.preview,
      };
    });
    out[c.id] = { pages, totalWords };
  }
  return out;
}

/** Total de páginas do corpo (somatório). */
export function totalBodyPages(pag: Record<string, ChapterPagination>): number {
  return Object.values(pag).reduce((acc, c) => acc + c.pages.length, 0);
}

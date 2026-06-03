import epub from "epub-gen-memory";

import { assembleMatter, type Matter } from "@/lib/matter";
import type { BookLayoutProfile } from "@/lib/layout/profile";
import { chapterToXhtml, matterToXhtml, epubCss } from "@/lib/render/semantic";

/**
 * Gera um EPUB 3 (em memória, JS puro) com front/back matter + capítulos +
 * sumário navegável. A APRESENTAÇÃO vem do Perfil de Layout (CSS reflowable,
 * unidades relativas, lang, hifenização); o CONTEÚDO é markup semântico
 * derivado do texto puro (lib/render/semantic.ts).
 *
 * Validação rígida (EPUBCheck) e PDF de impressão ficam para o worker.
 */
export async function buildEpub(
  book: { title?: string | null },
  chapters: { index: number; title: string | null; contentText: string | null }[],
  matter: Matter,
  year: number,
  profile: BookLayoutProfile,
  coverUrl?: string | null
): Promise<Buffer> {
  const author = matter.authorName?.trim() || "Autor";
  const { front, back } = assembleMatter({ title: book.title }, chapters, matter, year);
  const sorted = [...chapters].sort((a, b) => a.index - b.index);

  const content = [
    ...front.map((s) => {
      const { title, html } = matterToXhtml(s, profile);
      return { title, content: html, beforeToc: true };
    }),
    ...sorted.map((c) => {
      const { title, html } = chapterToXhtml(c, profile);
      return { title, content: html };
    }),
    ...back.map((s) => {
      const { title, html } = matterToXhtml(s, profile);
      return { title, content: html };
    }),
  ];

  const out = await epub(
    {
      title: book.title ?? "Sem título",
      author,
      lang: profile.text.locale,
      tocTitle: "Sumário",
      css: epubCss(profile),
      ...(coverUrl ? { cover: coverUrl } : {}),
      // Nosso render semântico já emite o <h1> do capítulo; evita título duplo.
      prependChapterTitles: false,
    },
    content
  );
  return out as Buffer;
}

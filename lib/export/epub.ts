import epub from "epub-gen-memory";

import { assembleMatter, type Matter } from "@/lib/matter";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function toHtml(text: string): string {
  const html = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
  return html || "<p></p>";
}

/**
 * Gera um EPUB 3 (em memória, JS puro) com front/back matter + capítulos +
 * sumário navegável. Validação rígida (EPUBCheck) e PDF ficam para o worker.
 */
export async function buildEpub(
  book: { title?: string | null },
  chapters: { index: number; title: string | null; contentText: string | null }[],
  matter: Matter,
  year: number
): Promise<Buffer> {
  const author = matter.authorName?.trim() || "Autor";
  const { front, back } = assembleMatter({ title: book.title }, chapters, matter, year);
  const sorted = [...chapters].sort((a, b) => a.index - b.index);

  const content = [
    ...front.map((s) => ({
      title: s.title,
      content: toHtml(s.body),
      beforeToc: true,
    })),
    ...sorted.map((c) => ({
      title: c.title ?? `Capítulo ${c.index}`,
      content: toHtml(c.contentText ?? ""),
    })),
    ...back.map((s) => ({ title: s.title, content: toHtml(s.body) })),
  ];

  const out = await epub(
    {
      title: book.title ?? "Sem título",
      author,
      lang: "pt",
      tocTitle: "Sumário",
    },
    content
  );
  return out as Buffer;
}

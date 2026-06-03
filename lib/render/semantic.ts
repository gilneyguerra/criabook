/**
 * Render semântico (REGRAS_DIAGRAMACAO §2.5 / §6.1).
 *
 * Deriva XHTML semântico LIMPO a partir do texto puro do capítulo + Perfil.
 * Princípio conteúdo ≠ apresentação: aqui NÃO há estilo inline — só estrutura
 * (section/h1/p + classes semânticas). A aparência vem do CSS do Perfil.
 *
 * O armazenamento canônico do CriaBook continua texto puro; este módulo é a
 * ponte para o export (EPUB já; PDF de impressão no worker depois).
 */

import type { BookLayoutProfile } from "@/lib/layout/profile";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Converte ênfase markdown leve em tags reais (aplicar APÓS escapeHtml). */
function emphasis(escaped: string): string {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/_([^_\n]+)_/g, "<em>$1</em>");
}

function para(text: string): string {
  return emphasis(escapeHtml(text)).replace(/\n/g, "<br/>");
}

/** Um parágrafo é diálogo se inicia com travessão (—). */
function isDialogue(p: string): boolean {
  return /^\s*—/.test(p);
}

type ChapterLike = {
  index: number;
  title: string | null;
  contentText: string | null;
};

/**
 * Converte o texto puro de um capítulo em uma `<section class="chapter">`
 * com `<h1>` e parágrafos semânticos. O 1º parágrafo recebe `.first`
 * (sem recuo, por convenção tipográfica); falas recebem `.dialogue`.
 */
export function chapterToXhtml(
  chapter: ChapterLike,
  profile: BookLayoutProfile
): { title: string; html: string } {
  const lang = profile.text.locale;
  const title = chapter.title ?? `Capítulo ${chapter.index}`;

  const paragraphs = (chapter.contentText ?? "")
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const body = paragraphs
    .map((p, i) => {
      const classes: string[] = [];
      if (i === 0) classes.push("first");
      if (isDialogue(p)) classes.push("dialogue");
      const cls = classes.length ? ` class="${classes.join(" ")}"` : "";
      // Quebras simples dentro do parágrafo viram <br/> (raro em prosa).
      return `<p${cls}>${para(p)}</p>`;
    })
    .join("\n");

  const html =
    `<section class="chapter" id="cap-${chapter.index}" lang="${lang}">\n` +
    `<h1 class="chapter-title">${escapeHtml(title)}</h1>\n` +
    `${body || "<p></p>"}\n` +
    `</section>`;

  return { title, html };
}

/** Converte uma seção de front/back matter (texto puro) em XHTML semântico. */
export function matterToXhtml(
  section: { title: string; body: string },
  profile: BookLayoutProfile
): { title: string; html: string } {
  const lang = profile.text.locale;
  const paragraphs = section.body
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${para(p)}</p>`)
    .join("\n");

  const html =
    `<section class="matter" lang="${lang}">\n` +
    `<h1 class="matter-title">${escapeHtml(section.title)}</h1>\n` +
    `${paragraphs || "<p></p>"}\n` +
    `</section>`;

  return { title: section.title, html };
}

/**
 * CSS reflowable derivado do Perfil (REGRAS_DIAGRAMACAO §4.2).
 * Regra de ouro: unidades RELATIVAS; nunca travar font-size do body em px.
 */
export function epubCss(profile: BookLayoutProfile): string {
  const e = profile.epub;
  const indented = e.paragraph === "indent";
  const pRules = indented
    ? `margin: 0; text-indent: ${e.paragraphIndentEm}em;`
    : `margin: 0 0 1em; text-indent: 0;`;

  return [
    `body { font-family: ${e.baseFontFamily}; line-height: ${e.lineHeight}; margin: 0; widows: 2; orphans: 2; }`,
    `p { ${pRules} ${e.justify ? "text-align: justify;" : ""} ${e.hyphensAuto ? "hyphens: auto; -webkit-hyphens: auto;" : ""} }`,
    // 1º parágrafo e parágrafo após título: sem recuo (convenção).
    `p.first { text-indent: 0; }`,
    `h1, h2 { font-size: 1.6em; line-height: 1.2; text-indent: 0; margin: 1em 0; }`,
    `h1.chapter-title { margin: 1.5em 0 1em; }`,
    `blockquote { margin: 1em 1.5em; font-style: italic; }`,
    `img { max-width: 100%; height: auto; }`,
  ].join("\n");
}

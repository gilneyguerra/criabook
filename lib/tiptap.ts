/**
 * Utilitários entre texto puro (com ênfase markdown leve) e o documento
 * ProseMirror/TipTap. A ênfase `*itálico*` / `**negrito**` vira mark real no
 * editor (e volta a markdown ao salvar — round-trip seguro), em vez de aparecer
 * com asteriscos literais.
 */

type Mark = { type: "italic" | "bold" };
type TextNode = { type: "text"; text: string; marks?: Mark[] };

export type TiptapDoc = {
  type: "doc";
  content: {
    type: "paragraph";
    content?: TextNode[];
  }[];
};

const INLINE = /(\*\*([^*]+)\*\*|\*([^*\n]+)\*|_([^_\n]+)_)/g;

/** Converte um parágrafo de texto em nós de texto com marks de ênfase. */
function parseInline(text: string): TextNode[] {
  const nodes: TextNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push({ type: "text", text: text.slice(last, m.index) });
    }
    if (m[2] !== undefined) {
      nodes.push({ type: "text", text: m[2], marks: [{ type: "bold" }] });
    } else {
      nodes.push({ type: "text", text: (m[3] ?? m[4]) as string, marks: [{ type: "italic" }] });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push({ type: "text", text: text.slice(last) });
  return nodes.length ? nodes : [{ type: "text", text }];
}

export function textToDoc(text: string): TiptapDoc {
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return {
    type: "doc",
    content:
      paragraphs.length > 0
        ? paragraphs.map((p) => ({
            type: "paragraph" as const,
            content: parseInline(p),
          }))
        : [{ type: "paragraph" as const }],
  };
}

/** Serializa um doc TipTap de volta para texto com ênfase markdown. */
export function docToText(doc: unknown): string {
  const d = doc as TiptapDoc | null;
  if (!d || !Array.isArray(d.content)) return "";
  return d.content
    .map((p) =>
      (p.content ?? [])
        .map((n) => {
          const marks = n.marks?.map((mk) => mk.type) ?? [];
          if (marks.includes("bold")) return `**${n.text}**`;
          if (marks.includes("italic")) return `*${n.text}*`;
          return n.text;
        })
        .join("")
    )
    .join("\n\n");
}

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

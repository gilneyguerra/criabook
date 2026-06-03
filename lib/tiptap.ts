/**
 * Utilitários entre texto puro (com ênfase markdown leve, quebra de cena e
 * subtítulos) e o documento ProseMirror/TipTap. A ênfase `*itálico*` /
 * `**negrito**` vira mark real; `* * *` numa linha é quebra de cena; `## x` é
 * subtítulo (heading 2). Tudo volta a markdown ao salvar (round-trip seguro).
 */

type Mark = { type: "italic" | "bold" };
type TextNode = { type: "text"; text: string; marks?: Mark[] };
type Block = {
  type: "paragraph" | "heading";
  attrs?: { level: number };
  content?: TextNode[];
};

export type TiptapDoc = { type: "doc"; content: Block[] };

const INLINE = /(\*\*([^*]+)\*\*|\*([^*\n]+)\*|_([^_\n]+)_)/g;

/** Linha que é só uma quebra de cena ("* * *", "***", "⁂"). */
export function isSceneBreak(s: string): boolean {
  const t = s.trim();
  return t === "⁂" || /^\*(\s*\*){1,4}$/.test(t);
}

/** Linha de subtítulo de seção ("## Texto"). */
export function isHeading(s: string): boolean {
  return /^#{1,3}\s+\S/.test(s.trim());
}

export function headingText(s: string): string {
  return s.trim().replace(/^#{1,3}\s+/, "");
}

function parseInline(text: string): TextNode[] {
  const nodes: TextNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) nodes.push({ type: "text", text: text.slice(last, m.index) });
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

  if (!paragraphs.length) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }

  return {
    type: "doc",
    content: paragraphs.map((p): Block => {
      if (isSceneBreak(p)) {
        // Plain (sem parseInline) p/ não virar itálico.
        return { type: "paragraph", content: [{ type: "text", text: "* * *" }] };
      }
      if (isHeading(p)) {
        return { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: headingText(p) }] };
      }
      return { type: "paragraph", content: parseInline(p) };
    }),
  };
}

/** Serializa um doc TipTap de volta para texto (ênfase + cena + subtítulo). */
export function docToText(doc: unknown): string {
  const d = doc as TiptapDoc | null;
  if (!d || !Array.isArray(d.content)) return "";
  return d.content
    .map((b) => {
      const inner = (b.content ?? [])
        .map((n) => {
          const marks = n.marks?.map((mk) => mk.type) ?? [];
          if (marks.includes("bold")) return `**${n.text}**`;
          if (marks.includes("italic")) return `*${n.text}*`;
          return n.text;
        })
        .join("");
      if (b.type === "heading") return `## ${inner}`;
      return inner;
    })
    .join("\n\n");
}

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

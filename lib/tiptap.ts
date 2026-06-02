/**
 * Utilitários entre texto puro e o documento ProseMirror/TipTap.
 */

export type TiptapDoc = {
  type: "doc";
  content: {
    type: "paragraph";
    content?: { type: "text"; text: string }[];
  }[];
};

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
            type: "paragraph",
            content: [{ type: "text", text: p }],
          }))
        : [{ type: "paragraph" }],
  };
}

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/**
 * Perfil de Layout — os "design tokens" do livro (REGRAS_DIAGRAMACAO §5).
 *
 * Princípio mestre: CONTEÚDO ≠ APRESENTAÇÃO. A IA gera texto/markup semântico
 * limpo; este perfil dirige TODA a apresentação (EPUB agora; PDF de impressão
 * no worker depois). Nada de dimensão visual hardcoded fora daqui.
 */

export type ParagraphStyle = "indent" | "spaced";

export interface BookLayoutProfile {
  // Identidade
  id: string;
  name: string;
  bookType: "fiction" | "nonfiction";

  // Impressão (consumido pelo pipeline de worker — Fase 2)
  print: {
    trim: { widthMm: number; heightMm: number };
    margins: { topMm: number; bottomMm: number; outerMm: number; gutterMm: number };
    bleedMm: number; // 0 ou 3.175
    bodyFont: string; // serifada
    bodySizePt: number; // 10–12
    leadingPct: number; // 120–145
    align: "justify";
    hyphenation: boolean;
    paragraph: ParagraphStyle;
    chapterStartsRecto: boolean;
    runningHeads: boolean;
    folios: boolean;
    pdfStandard: "PDF/X-1a" | "PDF/X-3";
    colorSpace: "cmyk" | "grayscale";
  };

  // Ebook (consumido já, pelo EPUB)
  epub: {
    version: "3.3";
    baseFontFamily: string; // fallback stack — o leitor pode sobrescrever
    lineHeight: number; // 1.4–1.6 (SEM unidade)
    paragraphIndentEm: number; // 1.2
    paragraph: ParagraphStyle;
    justify: boolean;
    hyphensAuto: boolean;
    embedFonts: boolean;
  };

  // Texto (passado ao prompt + normalizador — Camada A)
  text: {
    locale: "pt-BR";
    dialogueStyle: "travessao"; // travessão, não aspas
    quoteStyle: "curly"; // “ ”
    enforceTypographicChars: boolean;
    forbidLetterSpacingInBody: boolean;
  };
}

const SERIF_STACK = "Georgia, 'Times New Roman', serif";

/** Romance/ficção BR — 14×21 cm, recuo na 1ª linha, justificado, serifada. */
export const ROMANCE_BR_14X21: BookLayoutProfile = {
  id: "romance-br-14x21",
  name: "Romance BR 14×21",
  bookType: "fiction",
  print: {
    trim: { widthMm: 140, heightMm: 210 },
    margins: { topMm: 18, bottomMm: 18, outerMm: 14, gutterMm: 20 },
    bleedMm: 0,
    bodyFont: SERIF_STACK,
    bodySizePt: 11,
    leadingPct: 135,
    align: "justify",
    hyphenation: true,
    paragraph: "indent",
    chapterStartsRecto: true,
    runningHeads: true,
    folios: true,
    pdfStandard: "PDF/X-1a",
    colorSpace: "grayscale",
  },
  epub: {
    version: "3.3",
    baseFontFamily: SERIF_STACK,
    lineHeight: 1.5,
    paragraphIndentEm: 1.2,
    paragraph: "indent",
    justify: true,
    hyphensAuto: true,
    embedFonts: false,
  },
  text: {
    locale: "pt-BR",
    dialogueStyle: "travessao",
    quoteStyle: "curly",
    enforceTypographicChars: true,
    forbidLetterSpacingInBody: true,
  },
};

/** Não-ficção BR — 16×23 cm, espaço entre parágrafos (sem recuo), justificado. */
export const NAOFICCAO_16X23: BookLayoutProfile = {
  id: "naoficcao-16x23",
  name: "Não-ficção 16×23",
  bookType: "nonfiction",
  print: {
    trim: { widthMm: 160, heightMm: 230 },
    margins: { topMm: 20, bottomMm: 20, outerMm: 16, gutterMm: 22 },
    bleedMm: 0,
    bodyFont: SERIF_STACK,
    bodySizePt: 11,
    leadingPct: 140,
    align: "justify",
    hyphenation: true,
    paragraph: "spaced",
    chapterStartsRecto: true,
    runningHeads: true,
    folios: true,
    pdfStandard: "PDF/X-1a",
    colorSpace: "grayscale",
  },
  epub: {
    version: "3.3",
    baseFontFamily: SERIF_STACK,
    lineHeight: 1.55,
    paragraphIndentEm: 0,
    paragraph: "spaced",
    justify: true,
    hyphensAuto: true,
    embedFonts: false,
  },
  text: {
    locale: "pt-BR",
    dialogueStyle: "travessao",
    quoteStyle: "curly",
    enforceTypographicChars: true,
    forbidLetterSpacingInBody: true,
  },
};

/** Paperback 6×9 pol (US/KDP) — o formato mais comum em POD. */
export const PAPERBACK_6X9_US: BookLayoutProfile = {
  id: "paperback-6x9-us",
  name: "Paperback 6×9 (US/KDP)",
  bookType: "fiction",
  print: {
    trim: { widthMm: 152.4, heightMm: 228.6 },
    margins: { topMm: 16, bottomMm: 16, outerMm: 12.7, gutterMm: 19 },
    bleedMm: 0,
    bodyFont: SERIF_STACK,
    bodySizePt: 11,
    leadingPct: 135,
    align: "justify",
    hyphenation: true,
    paragraph: "indent",
    chapterStartsRecto: true,
    runningHeads: true,
    folios: true,
    pdfStandard: "PDF/X-1a",
    colorSpace: "grayscale",
  },
  epub: {
    version: "3.3",
    baseFontFamily: SERIF_STACK,
    lineHeight: 1.5,
    paragraphIndentEm: 1.2,
    paragraph: "indent",
    justify: true,
    hyphensAuto: true,
    embedFonts: false,
  },
  text: {
    locale: "pt-BR",
    dialogueStyle: "travessao",
    quoteStyle: "curly",
    enforceTypographicChars: true,
    forbidLetterSpacingInBody: true,
  },
};

export const LAYOUT_PROFILES: Record<string, BookLayoutProfile> = {
  [ROMANCE_BR_14X21.id]: ROMANCE_BR_14X21,
  [NAOFICCAO_16X23.id]: NAOFICCAO_16X23,
  [PAPERBACK_6X9_US.id]: PAPERBACK_6X9_US,
};

/** Lista para o seletor do wizard. */
export const LAYOUT_PROFILE_OPTIONS = Object.values(LAYOUT_PROFILES).map((p) => ({
  id: p.id,
  name: p.name,
  bookType: p.bookType,
}));

/** Perfil padrão sugerido pelo tipo do livro. */
export function defaultProfileIdForType(
  bookType?: string | null
): string {
  return bookType === "nonfiction" ? NAOFICCAO_16X23.id : ROMANCE_BR_14X21.id;
}

/**
 * Resolve o perfil de um livro: usa o `layoutProfileId` salvo se válido;
 * caso contrário, o default pelo tipo. Nunca retorna null.
 */
export function getLayoutProfile(
  profileId?: string | null,
  bookType?: string | null
): BookLayoutProfile {
  if (profileId && LAYOUT_PROFILES[profileId]) return LAYOUT_PROFILES[profileId];
  return LAYOUT_PROFILES[defaultProfileIdForType(bookType)];
}

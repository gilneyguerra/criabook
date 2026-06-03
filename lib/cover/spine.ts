/**
 * Cálculo da lombada (FERRAMENTA_CAPA §3.2). A largura só é conhecida após a
 * paginação (depende do total de páginas). Coeficientes aproximados — SEMPRE
 * confirmar com o provedor (KDP/IngramSpark) antes de imprimir.
 */

export type PaperType = "white" | "cream";

// mm por página (aprox.). Confirmar com a gráfica/provedor.
const COEF_MM_PER_PAGE: Record<PaperType, number> = {
  white: 0.0572,
  cream: 0.0635,
};

const WORDS_PER_PAGE = 280;

/** Estima o nº de páginas a partir da contagem total de palavras. */
export function estimatePages(totalWords: number): number {
  return Math.max(1, Math.ceil(totalWords / WORDS_PER_PAGE));
}

/** Largura da lombada em mm = páginas × coeficiente do papel. */
export function spineWidthMm(pages: number, paper: PaperType = "white"): number {
  return Math.round(pages * COEF_MM_PER_PAGE[paper] * 100) / 100;
}

/** Brochura KDP não tem orelhas. */
export function bindingAllowsFlaps(binding?: string | null): boolean {
  return binding === "brochura_orelhas";
}

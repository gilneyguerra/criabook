/**
 * Catálogo de Google Fonts para a tipografia da capa. Carregadas no cliente via
 * <link> (cover/page) e garantidas antes de desenhar no canvas (document.fonts).
 */

export type FontOption = { label: string; css: string; family: string };

// Família "css" = valor de font-family; "family" = nome exato p/ document.fonts.
function f(family: string, fallback: string): FontOption {
  return { label: family, family, css: `'${family}', ${fallback}` };
}

export const FONT_OPTIONS: FontOption[] = [
  // Serifadas / display
  f("Playfair Display", "serif"),
  f("Cormorant Garamond", "serif"),
  f("EB Garamond", "serif"),
  f("Cinzel", "serif"),
  f("Libre Baskerville", "serif"),
  f("Lora", "serif"),
  f("Merriweather", "serif"),
  f("Crimson Text", "serif"),
  f("Cardo", "serif"),
  f("Spectral", "serif"),
  f("Abril Fatface", "serif"),
  f("DM Serif Display", "serif"),
  f("Bodoni Moda", "serif"),
  f("Marcellus", "serif"),
  // Sem serifa
  f("Montserrat", "sans-serif"),
  f("Poppins", "sans-serif"),
  f("Raleway", "sans-serif"),
  f("Oswald", "sans-serif"),
  f("Bebas Neue", "sans-serif"),
  f("Archivo", "sans-serif"),
  f("Work Sans", "sans-serif"),
  f("Josefin Sans", "sans-serif"),
  f("Anton", "sans-serif"),
  // Manuscritas / script
  f("Lobster", "cursive"),
  f("Dancing Script", "cursive"),
  f("Pacifico", "cursive"),
  f("Great Vibes", "cursive"),
  f("Cormorant SC", "serif"),
];

/** URL única do Google Fonts com todas as famílias (400 e 700). */
export function googleFontsHref(): string {
  const families = FONT_OPTIONS.map(
    (o) => `family=${o.family.replace(/ /g, "+")}:wght@400;700`
  ).join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

/** Garante que uma família está carregada antes de desenhar no canvas. */
export async function ensureFont(css: string, sizePx = 120): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await document.fonts.load(`700 ${sizePx}px ${css}`);
    await document.fonts.load(`400 ${sizePx}px ${css}`);
  } catch {
    // ignora — cai no fallback
  }
}

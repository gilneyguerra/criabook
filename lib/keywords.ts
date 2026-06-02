/**
 * Categorias do construtor de prompt (Fase 3). `key` casa com o enum
 * keyword_category do schema. `fallback` é usado quando não há ANTHROPIC_API_KEY.
 */
export const KEYWORD_CATEGORIES = [
  {
    key: "genre",
    label: "Gênero",
    fallback: ["Romance", "Fantasia", "Suspense", "Aventura", "Drama", "Ficção científica"],
  },
  {
    key: "character_role",
    label: "Personagens",
    fallback: ["Herói relutante", "Mentor", "Antagonista", "Aliado leal", "Interesse romântico"],
  },
  {
    key: "plot_twist",
    label: "Plot-twist",
    fallback: ["Traição inesperada", "Identidade revelada", "Sacrifício", "Superação", "Recomeço"],
  },
  {
    key: "tone",
    label: "Tom",
    fallback: ["Sombrio", "Esperançoso", "Melancólico", "Bem-humorado", "Épico", "Intimista"],
  },
  {
    key: "setting",
    label: "Ambientação",
    fallback: ["Vilarejo medieval", "Metrópole futurista", "Floresta encantada", "Litoral", "Estação espacial"],
  },
  {
    key: "theme",
    label: "Tema",
    fallback: ["Perdão", "Coragem", "Pertencimento", "Liberdade", "Memória", "Identidade"],
  },
] as const;

export type KeywordCategoryKey = (typeof KEYWORD_CATEGORIES)[number]["key"];

export function getCategory(key: string) {
  return KEYWORD_CATEGORIES.find((c) => c.key === key);
}

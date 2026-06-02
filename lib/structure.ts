/**
 * Templates de estrutura narrativa (Fase B). Cada método define os beats
 * canônicos; a IA preenche título/descrição específicos para o livro.
 */

export type BeatTemplate = { beatType: string; label: string; climax?: boolean };

export const STRUCTURE_TEMPLATES: Record<string, BeatTemplate[]> = {
  three_act: [
    { beatType: "setup", label: "Ato 1 — Apresentação" },
    { beatType: "inciting_incident", label: "Incidente incitante" },
    { beatType: "plot_point_1", label: "Virada do 1º ato" },
    { beatType: "rising_action", label: "Ato 2 — Confronto" },
    { beatType: "midpoint", label: "Ponto médio" },
    { beatType: "plot_point_2", label: "Virada do 2º ato" },
    { beatType: "climax", label: "Ato 3 — Clímax", climax: true },
    { beatType: "resolution", label: "Resolução" },
  ],
  hero_journey: [
    { beatType: "ordinary_world", label: "Mundo comum" },
    { beatType: "call", label: "Chamado à aventura" },
    { beatType: "refusal", label: "Recusa do chamado" },
    { beatType: "mentor", label: "Encontro com o mentor" },
    { beatType: "threshold", label: "Travessia do limiar" },
    { beatType: "tests", label: "Provas, aliados e inimigos" },
    { beatType: "approach", label: "Aproximação da caverna" },
    { beatType: "ordeal", label: "Provação", climax: true },
    { beatType: "reward", label: "Recompensa" },
    { beatType: "road_back", label: "Caminho de volta" },
    { beatType: "resurrection", label: "Ressurreição" },
    { beatType: "return", label: "Retorno com o elixir" },
  ],
  save_the_cat: [
    { beatType: "opening_image", label: "Imagem de abertura" },
    { beatType: "theme_stated", label: "Tema declarado" },
    { beatType: "setup", label: "Apresentação" },
    { beatType: "catalyst", label: "Catalisador" },
    { beatType: "debate", label: "Debate" },
    { beatType: "break_into_two", label: "Entrada no 2º ato" },
    { beatType: "b_story", label: "História B" },
    { beatType: "fun_and_games", label: "Diversão e jogos" },
    { beatType: "midpoint", label: "Ponto médio" },
    { beatType: "bad_guys_close_in", label: "Vilões se aproximam" },
    { beatType: "all_is_lost", label: "Tudo está perdido" },
    { beatType: "dark_night", label: "Noite escura da alma" },
    { beatType: "break_into_three", label: "Entrada no 3º ato" },
    { beatType: "finale", label: "Final", climax: true },
    { beatType: "final_image", label: "Imagem final" },
  ],
  story_circle: [
    { beatType: "you", label: "1. Você (zona de conforto)" },
    { beatType: "need", label: "2. Necessidade" },
    { beatType: "go", label: "3. Partida" },
    { beatType: "search", label: "4. Busca/adaptação" },
    { beatType: "find", label: "5. Encontro", climax: true },
    { beatType: "take", label: "6. Preço pago" },
    { beatType: "return", label: "7. Retorno" },
    { beatType: "change", label: "8. Mudança" },
  ],
  nonfiction: [
    { beatType: "problem", label: "O problema" },
    { beatType: "stakes", label: "Por que importa" },
    { beatType: "solution", label: "A solução/tese" },
    { beatType: "framework", label: "O método (visão geral)" },
    { beatType: "steps", label: "Passos práticos" },
    { beatType: "example", label: "Exemplos e provas" },
    { beatType: "action", label: "Plano de ação" },
  ],
};

export function getTemplate(method?: string | null): BeatTemplate[] {
  return STRUCTURE_TEMPLATES[method ?? "three_act"] ?? STRUCTURE_TEMPLATES.three_act;
}

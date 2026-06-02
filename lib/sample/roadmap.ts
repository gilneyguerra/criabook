import type { OrbitalNode } from "@/components/ui/radial-orbital-timeline";

/**
 * Dados de exemplo para o Mapa da história (Fase 7).
 * Serão substituídos pelos `story_beats`/`chapters` reais quando existirem.
 */
export const sampleRoadmap: OrbitalNode[] = [
  {
    id: "b1",
    title: "Prólogo",
    summary: "O envelope sem remetente que muda tudo para Lia.",
    type: "beat",
    status: "done",
    relatedIds: ["c1"],
  },
  {
    id: "c1",
    title: "1 · O chamado",
    summary: "Lia decide partir do vilarejo em busca da verdade.",
    type: "chapter",
    status: "done",
    relatedIds: ["b1", "b2"],
  },
  {
    id: "b2",
    title: "Ponto de virada",
    summary: "A descoberta que torna o retorno impossível.",
    type: "beat",
    status: "draft",
    relatedIds: ["c1", "c2"],
  },
  {
    id: "c2",
    title: "2 · A travessia",
    summary: "A jornada pela floresta e o primeiro aliado.",
    type: "chapter",
    status: "draft",
    relatedIds: ["b2", "x1"],
  },
  {
    id: "x1",
    title: "Clímax",
    summary: "O confronto que define o destino da protagonista.",
    type: "climax",
    status: "pending",
    relatedIds: ["c2", "c3"],
  },
  {
    id: "c3",
    title: "3 · O retorno",
    summary: "As consequências e o novo começo.",
    type: "chapter",
    status: "pending",
    relatedIds: ["x1"],
  },
];

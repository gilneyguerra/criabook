import { describe, it, expect } from "vitest";

import { normalize } from "./normalizer";
import { ROMANCE_BR_14X21 } from "@/lib/layout/profile";

const P = ROMANCE_BR_14X21;
const n = (s: string) => normalize(s, P);

describe("normalizador tipográfico (Camada A)", () => {
  it("converte reticências '...' em caractere único …", () => {
    expect(n("Ele hesitou... e partiu.")).toBe("Ele hesitou… e partiu.");
    expect(n("Espere....")).toBe("Espere…");
  });

  it("converte intervalo numérico em meia-risca (en dash)", () => {
    expect(n("páginas 10-20")).toBe("páginas 10–20");
    expect(n("anos 1990 - 2000")).toBe("anos 1990–2000");
  });

  it("usa travessão no início de fala de diálogo", () => {
    expect(n("- Você veio mesmo.")).toBe("— Você veio mesmo.");
    expect(n("-- Talvez.")).toBe("— Talvez.");
  });

  it("converte hífen espaçado (pausa) em travessão", () => {
    expect(n("Ela sorriu - sem vontade.")).toBe("Ela sorriu — sem vontade.");
  });

  it("PRESERVA hífen de palavra composta", () => {
    expect(n("Pegou o guarda-chuva.")).toBe("Pegou o guarda-chuva.");
    expect(n("segunda-feira")).toBe("segunda-feira");
  });

  it("converte aspas retas em aspas curvas pt-BR", () => {
    expect(n('Ele disse "olá" a ela.')).toBe("Ele disse “olá” a ela.");
  });

  it("trata apóstrofo entre letras como aspa de fechamento curva", () => {
    expect(n("copo d'água")).toBe("copo d’água");
  });

  it("colapsa espaços múltiplos em um", () => {
    expect(n("dois    espaços")).toBe("dois espaços");
  });

  it("remove espaço antes de pontuação", () => {
    expect(n("Sério ? Sim !")).toBe("Sério? Sim!");
    expect(n("Bem , veja .")).toBe("Bem, veja.");
  });

  it("preserva a estrutura de parágrafos (linha em branco dupla)", () => {
    const input = "Primeiro parágrafo.\n\nSegundo parágrafo.";
    expect(n(input)).toBe("Primeiro parágrafo.\n\nSegundo parágrafo.");
  });

  it("garante exatamente um espaço após o travessão de diálogo", () => {
    expect(n("-   Vamos")).toBe("— Vamos");
  });

  it("é idempotente (normalizar de novo não muda nada)", () => {
    const once = n('- "Olá"... veja 1-2 e guarda-chuva.');
    expect(n(once)).toBe(once);
  });

  it("não quebra texto vazio", () => {
    expect(n("")).toBe("");
  });
});

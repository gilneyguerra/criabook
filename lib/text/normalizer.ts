/**
 * Normalizador tipográfico (REGRAS_DIAGRAMACAO — Camada A).
 *
 * Opera sobre TEXTO PURO (o formato canônico do CriaBook: parágrafos separados
 * por linha em branco). Garante que o texto saia "pronto", sem gambiarras de
 * formatação: aspas curvas, travessão de diálogo, reticências, sem espaço
 * duplo, sem espaço antes de pontuação. NUNCA insere letter-spacing.
 *
 * Princípio: conservador. Na dúvida, não altera (ex.: hífens de compostos
 * como "guarda-chuva" são preservados — só hífens espaçados/duplos viram
 * travessão).
 */

import type { BookLayoutProfile } from "@/lib/layout/profile";

/** Aspas duplas retas → curvas pt-BR (“ ”), pareando abre/fecha. */
function curlyDoubleQuotes(s: string): string {
  let open = true;
  return s.replace(/"/g, () => {
    const q = open ? "“" : "”"; // “ ”
    open = !open;
    return q;
  });
}

/**
 * Aspas simples retas → curvas (‘ ’), pareando. Preserva apóstrofo entre
 * letras (ex.: d'água) como aspa de fechamento curva (’), que é a convenção.
 */
function curlySingleQuotes(s: string): string {
  // Apóstrofo entre duas letras = ’ (fechamento), não par de aspas.
  let out = s.replace(/(\p{L})'(\p{L})/gu, "$1’$2");
  let open = true;
  out = out.replace(/'/g, () => {
    const q = open ? "‘" : "’"; // ‘ ’
    open = !open;
    return q;
  });
  return out;
}

/** Aplica as conversões tipográficas a UMA linha de parágrafo. */
function normalizeParagraph(line: string, profile: BookLayoutProfile): string {
  let s = line;

  if (profile.text.enforceTypographicChars) {
    // Reticências: "..." (3+ pontos) → … (caractere único)
    s = s.replace(/\.{3,}/g, "…");

    // Intervalos numéricos: 1-10 / 1 - 10 → 1–10 (meia-risca / en dash)
    s = s.replace(/(\d)\s*-\s*(\d)/g, "$1–$2");

    if (profile.text.dialogueStyle === "travessao") {
      // Linha de diálogo: começa com hífen/menos/en-dash + espaço → travessão.
      s = s.replace(/^\s*[-–]+\s*/, "— ");
      // Hífen duplo em qualquer posição → travessão.
      s = s.replace(/\s*--\s*/g, " — ");
      // Hífen ESPAÇADO (pausa) → travessão. Compostos (sem espaço) ficam.
      s = s.replace(/ - /g, " — ");
    }

    if (profile.text.quoteStyle === "curly") {
      s = curlyDoubleQuotes(s);
      s = curlySingleQuotes(s);
    }
  }

  // Espaços múltiplos → um. (Tabs viram espaço.)
  s = s.replace(/[ \t]{2,}/g, " ");
  // Sem espaço antes de pontuação.
  s = s.replace(/\s+([,.;:!?…])/g, "$1");
  // Normaliza travessão recém-criado: garante exatamente um espaço após.
  s = s.replace(/—\s+/g, "— ");

  return s.trim();
}

/**
 * Normaliza um texto puro inteiro, preservando a estrutura de parágrafos
 * (linhas em branco duplas). NUNCA mexe em letter-spacing.
 */
export function normalize(text: string, profile: BookLayoutProfile): string {
  if (!text) return text;
  // Normaliza quebras de linha e separa parágrafos por linha em branco.
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) =>
      // Cada parágrafo pode ter quebras simples internas: normaliza linha a linha.
      p
        .split("\n")
        .map((line) => normalizeParagraph(line, profile))
        .join("\n")
    );
  return paragraphs.join("\n\n");
}

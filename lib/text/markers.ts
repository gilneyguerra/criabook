/**
 * Marcadores internos do motor de consistência emitidos pelo gerador:
 *   [NOVO_FATO: x] → registra x no cânone (fato novo e durável); some da prosa.
 *   [LACUNA: x]    → vira issue soft (pendência ao autor); some da prosa.
 *
 * NUNCA devem aparecer ao usuário: são removidos antes de exibir/persistir. Esta
 * função é PURA (sem dependências de servidor) para poder rodar também no
 * cliente como rede de segurança (ex.: geração interrompida por queda de rede).
 */
export function stripMarkers(text: string): {
  clean: string;
  novoFatos: string[];
  lacunas: string[];
} {
  const novoFatos: string[] = [];
  const lacunas: string[] = [];

  let clean = (text ?? "").replace(/\[NOVO_FATO:\s*([^\]]+)\]/gi, (_m, g1) => {
    novoFatos.push(String(g1).trim());
    return "";
  });
  clean = clean.replace(/\[LACUNA:\s*([^\]]+)\]/gi, (_m, g1) => {
    lacunas.push(String(g1).trim());
    return "";
  });
  // Limpa espaços/linhas órfãs deixadas pela remoção.
  clean = clean
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { clean, novoFatos, lacunas };
}

/** Atalho: retorna só o texto limpo (sem capturar fatos/lacunas). */
export function stripMarkersText(text: string): string {
  return stripMarkers(text).clean;
}

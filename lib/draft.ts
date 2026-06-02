/**
 * Rascunhos locais (localStorage) para recuperação estilo Word:
 * sobrevive a fechar a aba e a queda de energia. Por dispositivo/navegador.
 */

export type Draft = {
  json: unknown;
  text: string;
  at: number; // epoch ms
};

const key = (chapterId: string) => `criabook:draft:${chapterId}`;

export function saveDraft(chapterId: string, draft: Draft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(chapterId), JSON.stringify(draft));
  } catch {
    // cota cheia / modo privado — ignora
  }
}

export function loadDraft(chapterId: string): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(chapterId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft;
    if (typeof parsed?.text !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft(chapterId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(chapterId));
  } catch {
    // ignora
  }
}

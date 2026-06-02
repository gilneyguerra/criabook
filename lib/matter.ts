/**
 * Front/back matter: páginas que fazem o livro parecer profissional, geradas
 * a partir dos metadados. Os campos editáveis são guardados em book_meta.matter;
 * copyright, sumário e disclosure de IA são derivados na montagem.
 */

export type Matter = {
  authorName?: string;
  dedication?: string;
  epigraph?: string;
  aboutAuthor?: string;
  acknowledgments?: string;
  cta?: string;
};

export const AI_DISCLOSURE =
  "Este livro foi criado com o auxílio de inteligência artificial. " +
  "O conteúdo foi revisado e editado pelo autor, que detém todos os direitos " +
  "comerciais da obra. O texto do usuário não é utilizado para treinar modelos de IA.";

export type MatterSection = { title: string; body: string };

export function assembleMatter(
  book: { title?: string | null },
  chapters: { title: string | null; index: number }[],
  matter: Matter,
  year: number
): { front: MatterSection[]; back: MatterSection[] } {
  const author = matter.authorName?.trim() || "Autor";

  const toc = chapters
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((c) => `${c.index}. ${c.title ?? `Capítulo ${c.index}`}`)
    .join("\n");

  const front: MatterSection[] = [
    { title: "Folha de rosto", body: `${book.title ?? "Sem título"}\n\n${author}` },
    {
      title: "Copyright",
      body: `© ${year} ${author}. Todos os direitos reservados.\n\n${AI_DISCLOSURE}`,
    },
  ];
  if (matter.dedication?.trim())
    front.push({ title: "Dedicatória", body: matter.dedication.trim() });
  if (matter.epigraph?.trim())
    front.push({ title: "Epígrafe", body: matter.epigraph.trim() });
  if (toc) front.push({ title: "Sumário", body: toc });

  const back: MatterSection[] = [];
  if (matter.aboutAuthor?.trim())
    back.push({ title: "Sobre o autor", body: matter.aboutAuthor.trim() });
  if (matter.acknowledgments?.trim())
    back.push({ title: "Agradecimentos", body: matter.acknowledgments.trim() });
  if (matter.cta?.trim())
    back.push({ title: "Continue lendo", body: matter.cta.trim() });
  back.push({ title: "Aviso de IA", body: AI_DISCLOSURE });

  return { front, back };
}

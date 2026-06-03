import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getBookForUser, getStoryBeats } from "@/lib/db/queries";
import { RoadmapView, type BeatRow } from "./_components/roadmap-view";
import { NextStep } from "../_components/next-step";

const DEMO_BEATS: BeatRow[] = [
  { id: "b1", order: 0, title: "Prólogo", summary: "O envelope sem remetente que muda tudo para Lia.", beatType: "setup" },
  { id: "c1", order: 1, title: "O chamado", summary: "Lia decide partir do vilarejo em busca da verdade.", beatType: "inciting_incident" },
  { id: "b2", order: 2, title: "Ponto de virada", summary: "A descoberta que torna o retorno impossível.", beatType: "plot_point_1" },
  { id: "c2", order: 3, title: "A travessia", summary: "A jornada pela floresta e o primeiro aliado.", beatType: "rising_action" },
  { id: "x1", order: 4, title: "Clímax", summary: "O confronto que define o destino da protagonista.", beatType: "climax" },
  { id: "c3", order: 5, title: "O retorno", summary: "As consequências e o novo começo.", beatType: "resolution" },
];

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  if (bookId === "demo") {
    return (
      <RoadmapView
        bookId="demo"
        bookTitle="A última carta"
        isDemo
        initialBeats={DEMO_BEATS}
      />
    );
  }

  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) notFound();

  const beats = await getStoryBeats(bookId).catch(() => []);
  return (
    <>
      <RoadmapView
        bookId={bookId}
        bookTitle={book.title ?? "Meu livro"}
        isDemo={false}
        initialBeats={beats.map((b) => ({
          id: b.id,
          order: b.order,
          title: b.title ?? "",
          summary: b.summary ?? "",
          beatType: b.beatType ?? "beat",
        }))}
      />
      <div className="mx-auto flex max-w-3xl justify-end px-6 pb-10">
        <NextStep bookId={bookId} seg="write" label="Escrita" />
      </div>
    </>
  );
}

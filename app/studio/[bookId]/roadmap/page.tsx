import { sampleRoadmap } from "@/lib/sample/roadmap";
import { RoadmapView } from "./_components/roadmap-view";

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const isDemo = bookId === "demo";

  // Fase 7: quando houver livros/beats reais, buscar via getBookForUser(bookId, userId)
  // + os story_beats do banco. Por enquanto, dados de exemplo.
  const nodes = sampleRoadmap;
  const bookTitle = isDemo ? "A última carta" : "Meu livro";

  return <RoadmapView nodes={nodes} bookTitle={bookTitle} isDemo={isDemo} />;
}

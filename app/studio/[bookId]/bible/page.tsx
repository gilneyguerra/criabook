import { redirect } from "next/navigation";

// Base e Bíblia foram fundidas na etapa "1 Base & Bíblia" (/prompt).
export default async function BibleRedirect({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  redirect(`/studio/${bookId}/prompt`);
}

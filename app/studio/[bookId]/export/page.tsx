import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getBookForUser, getChapters } from "@/lib/db/queries";
import { ExportPanel } from "./_components/export-panel";

export default async function ExportPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) notFound();

  const chapters = await getChapters(bookId);

  return (
    <ExportPanel
      bookId={bookId}
      bookTitle={book.title ?? "Sem título"}
      chapterCount={chapters.length}
    />
  );
}

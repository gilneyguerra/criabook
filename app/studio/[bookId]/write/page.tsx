import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getBookForUser, getChapters } from "@/lib/db/queries";
import { getBalance } from "@/lib/credits";
import { WritingStudio } from "./_components/writing-studio";

export default async function WritePage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) notFound();

  const chapters = await getChapters(bookId).catch(() => []);
  const balance = await getBalance(session.user.id).catch(() => 0);

  return (
    <WritingStudio
      bookId={bookId}
      title={book.title ?? "Sem título"}
      pageTarget={book.pageTarget ?? 0}
      initialBalance={balance}
      initialChapters={chapters.map((c) => ({
        id: c.id,
        index: c.index,
        title: c.title ?? `Capítulo ${c.index}`,
        contentText: c.contentText ?? "",
      }))}
    />
  );
}

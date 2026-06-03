import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getBookForUser, getChapters, getBookMeta } from "@/lib/db/queries";
import { getBalance } from "@/lib/credits";
import { getLayoutProfile } from "@/lib/layout/profile";
import { wordsPerPage } from "@/lib/pagination";
import { assembleMatter, type Matter } from "@/lib/matter";
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
  const meta = await getBookMeta(bookId).catch(() => null);

  const profile = getLayoutProfile(book.layoutProfileId, book.type);
  const wpp = wordsPerPage(profile);
  // Páginas pré-textuais (contadas, não exibidas) = nº de seções de front matter.
  const matter = (meta?.matter ?? {}) as Matter;
  const front = assembleMatter({ title: book.title }, [], matter, new Date().getFullYear()).front;
  const frontMatterPages = Math.max(2, front.length);

  return (
    <WritingStudio
      bookId={bookId}
      title={book.title ?? "Sem título"}
      pageTarget={book.pageTarget ?? 0}
      initialBalance={balance}
      wordsPerPage={wpp}
      frontMatterPages={frontMatterPages}
      initialChapters={chapters.map((c) => ({
        id: c.id,
        index: c.index,
        title: c.title ?? `Capítulo ${c.index}`,
        contentText: c.contentText ?? "",
      }))}
    />
  );
}

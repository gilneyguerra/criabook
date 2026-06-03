import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import {
  getBookForUser,
  getCover,
  getChapters,
  getBookMeta,
} from "@/lib/db/queries";
import { getBalance } from "@/lib/credits";
import { wordCount } from "@/lib/tiptap";
import type { Matter } from "@/lib/matter";
import { CoverDesigner } from "./_components/cover-designer";

export default async function CoverPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) notFound();

  const [cover, chapters, meta, balance] = await Promise.all([
    getCover(bookId).catch(() => null),
    getChapters(bookId).catch(() => []),
    getBookMeta(bookId).catch(() => null),
    getBalance(session.user.id).catch(() => 0),
  ]);

  const matter = (meta?.matter ?? {}) as Matter;
  const totalWords = chapters.reduce((a, c) => a + wordCount(c.contentText ?? ""), 0);

  const initial: Record<string, unknown> = {
    ...(cover ?? {}),
    title: cover?.title ?? book.title ?? "",
    authorName: cover?.authorName ?? matter.authorName ?? "",
    flapBio: cover?.flapBio ?? matter.aboutAuthor ?? "",
  };

  return (
    <CoverDesigner
      bookId={bookId}
      initial={initial}
      totalWords={totalWords}
      initialBalance={balance}
    />
  );
}

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getBookForUser, getChapters, getBookMeta } from "@/lib/db/queries";
import type { Matter } from "@/lib/matter";
import { MatterEditor } from "./_components/matter-editor";
import { NextStep } from "../_components/next-step";

export default async function MatterPage({
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
  const meta = await getBookMeta(bookId).catch(() => null);
  const matter = (meta?.matter ?? {}) as Matter;

  return (
    <>
      <MatterEditor
        bookId={bookId}
        bookTitle={book.title ?? "Sem título"}
        chapters={chapters.map((c) => ({
          index: c.index,
          title: c.title ?? `Capítulo ${c.index}`,
        }))}
        initialMatter={matter}
      />
      <div className="mx-auto flex max-w-3xl justify-end px-6 pb-10">
        <NextStep bookId={bookId} seg="export" label="Exportar" />
      </div>
    </>
  );
}

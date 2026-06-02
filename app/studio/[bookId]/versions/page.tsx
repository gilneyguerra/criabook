import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getBookForUser, getVersions } from "@/lib/db/queries";
import { VersionsList } from "./_components/versions-list";

export default async function VersionsPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) notFound();

  const versions = await getVersions(bookId).catch(() => []);

  return (
    <VersionsList
      bookId={bookId}
      bookTitle={book.title ?? "Sem título"}
      versions={versions.map((v) => ({
        id: v.id,
        label: v.label ?? "Versão",
        chapterTitle: v.chapterTitle ?? null,
        createdAt: v.createdAt ? new Date(v.createdAt).toISOString() : "",
      }))}
    />
  );
}

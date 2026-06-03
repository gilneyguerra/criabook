import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getBookForUser, getBible } from "@/lib/db/queries";
import { FoundationStudio } from "./_components/foundation-studio";

export default async function FoundationPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) notFound();

  const bible = await getBible(bookId);
  const brief = (book.brief ?? {}) as Record<string, string[]>;

  return (
    <FoundationStudio
      bookId={bookId}
      bookTitle={book.title ?? "Sem título"}
      initialTitle={book.title ?? ""}
      initialSelections={brief}
      initialEditorial={{
        type: (book.type as "fiction" | "nonfiction") ?? "fiction",
        logline: book.logline ?? "",
        audience: book.audience ?? "",
        pov: book.pov ?? "",
        tone: book.tone ?? "",
        structureMethod: book.structureMethod ?? "",
        layoutProfileId: book.layoutProfileId ?? "",
      }}
      bible={bible}
    />
  );
}

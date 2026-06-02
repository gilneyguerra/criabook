import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getBookForUser, getBible } from "@/lib/db/queries";
import { BibleManager } from "./_components/bible-manager";

export default async function BiblePage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) notFound();

  const bible = await getBible(bookId).catch(() => ({
    characters: [],
    locations: [],
    worldRules: [],
    timeline: [],
    glossary: [],
  }));

  return <BibleManager bookId={bookId} bookTitle={book.title ?? "Sem título"} bible={bible} />;
}

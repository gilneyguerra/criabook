import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getBookForUser } from "@/lib/db/queries";
import { ConsistencyChecker } from "./_components/consistency-checker";

export default async function CheckPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) notFound();

  return <ConsistencyChecker bookId={bookId} bookTitle={book.title ?? "Sem título"} />;
}

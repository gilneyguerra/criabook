import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getBookForUser } from "@/lib/db/queries";
import { PromptBuilder } from "./_components/prompt-builder";

export default async function PromptPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) notFound();

  const brief = (book.brief ?? {}) as Record<string, string[]>;

  return (
    <PromptBuilder
      bookId={bookId}
      initialTitle={book.title ?? ""}
      initialSelections={brief}
    />
  );
}

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getBookForUser } from "@/lib/db/queries";
import {
  getIssues,
  getThreads,
  getTimelineEvents,
} from "@/lib/memory/ledgers";
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

  const [issues, threads, timeline] = await Promise.all([
    getIssues(bookId),
    getThreads(bookId),
    getTimelineEvents(bookId),
  ]);

  return (
    <ConsistencyChecker
      bookId={bookId}
      bookTitle={book.title ?? "Sem título"}
      initialIssues={issues.map((i) => ({
        id: i.id,
        chapter: i.chapter,
        type: i.type,
        severity: i.severity,
        description: i.description,
        conflictsWith: i.conflictsWith,
        status: i.status,
      }))}
      threads={threads.map((t) => ({
        id: t.id,
        description: t.description,
        openedInChapter: t.openedInChapter,
        closedInChapter: t.closedInChapter,
        status: t.status,
      }))}
      timeline={timeline.map((e) => ({
        id: e.id,
        order: e.order,
        description: e.description,
        chapterRef: e.chapterRef,
        storyTime: e.storyTime,
        participants: Array.isArray(e.participants)
          ? (e.participants as string[])
          : [],
      }))}
    />
  );
}

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { getStudioProgress } from "@/lib/studio/progress";
import { StudioNav } from "./_components/studio-nav";
import { CopyGuard } from "./_components/copy-guard";

export default async function StudioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ bookId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }
  const { bookId } = await params;
  const progress = await getStudioProgress(bookId, session.user.id);

  return (
    <div className="flex min-h-screen flex-col">
      <CopyGuard />
      <header className="flex items-center gap-3 border-b px-4 py-2.5">
        <Link
          href="/dashboard"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm text-foreground hover:text-indigo-700"
        >
          <ArrowLeft className="size-4" />
          <span className="link-underline hidden sm:inline">Dashboard</span>
        </Link>
        <span className="h-5 w-px shrink-0 bg-border" />
        <StudioNav bookId={bookId} progress={progress} />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

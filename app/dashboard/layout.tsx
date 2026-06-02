import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";

import { auth } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import { DottedSurface } from "@/components/ui/dotted-surface";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Fundo: superfície de pontos ondulando como um mar. */}
      <DottedSurface className="z-0" />
      <header className="relative z-10 flex items-center justify-between border-b bg-background/80 px-6 py-4 backdrop-blur">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-semibold"
        >
          <BookOpen className="size-5" />
          CriaBook
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {session.user.email}
          </span>
          <LogoutButton />
        </div>
      </header>
      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}

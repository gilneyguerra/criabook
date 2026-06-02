import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";

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

  const navItems = [
    { href: `/studio/${bookId}/write`, label: "Escrita" },
    { href: `/studio/${bookId}/bible`, label: "Bíblia" },
    { href: `/studio/${bookId}/roadmap`, label: "Mapa" },
    { href: `/studio/${bookId}/check`, label: "Revisão" },
    { href: `/studio/${bookId}/matter`, label: "Páginas" },
    { href: `/studio/${bookId}/prompt`, label: "Base" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-4 border-b px-6 py-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          <span className="link-underline">Dashboard</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="link-underline text-muted-foreground hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

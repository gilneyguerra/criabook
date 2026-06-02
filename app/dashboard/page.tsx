import Link from "next/link";
import { headers } from "next/headers";
import { BookPlus, Map } from "lucide-react";

import { auth } from "@/lib/auth";
import { getUserBooks } from "@/lib/db/queries";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  let books: Awaited<ReturnType<typeof getUserBooks>> = [];
  if (session) {
    try {
      books = await getUserBooks(session.user.id);
    } catch {
      // Tabelas ainda não migradas: degrada para lista vazia.
      books = [];
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meus livros</h1>
          <p className="text-sm text-muted-foreground">
            Crie um novo livro ou continue um rascunho.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/studio/demo/roadmap">
              <Map className="size-4" />
              Mapa da história (demo)
            </Link>
          </Button>
          {/* A criação de livro é habilitada na Fase 3 (construtor de prompt). */}
          <Button disabled>
            <BookPlus className="size-4" />
            Novo livro
          </Button>
        </div>
      </div>

      {books.length === 0 ? (
        <Card className="items-center gap-3 border-dashed py-16 text-center">
          <CardHeader className="items-center">
            <CardTitle>Nenhum livro ainda</CardTitle>
            <CardDescription>
              A criação de livros chega na Fase 3 (construtor de prompt).
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <Link key={book.id} href={`/studio/${book.id}`}>
              <Card className="h-full transition-colors hover:border-foreground/30">
                <CardHeader>
                  <CardTitle>{book.title ?? "Sem título"}</CardTitle>
                  <CardDescription>
                    {book.genre ?? "—"} · {book.status}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

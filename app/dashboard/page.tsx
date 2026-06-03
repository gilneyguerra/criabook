import Link from "next/link";
import { headers } from "next/headers";
import { BookPlus, Map } from "lucide-react";

import { auth } from "@/lib/auth";
import { getUserBooks } from "@/lib/db/queries";
import { createBook } from "./actions";
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
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border bg-background/70 p-8 text-center backdrop-blur">
        <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
          Pronto para navegar em palavras?
        </h1>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          Comece um novo livro e veja a história nascer, capítulo a capítulo.
        </p>
      </section>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Meus livros</h2>
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
          <form action={createBook}>
            <Button type="submit">
              <BookPlus className="size-4" />
              Novo livro
            </Button>
          </form>
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
            <Link key={book.id} href={`/studio/${book.id}/write`}>
              <Card className="card-lift h-full overflow-hidden hover:border-indigo-500/40">
                <div className="flex aspect-[5/7] max-h-44 items-center justify-center overflow-hidden bg-secondary/40">
                  {book.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={book.coverUrl}
                      alt={`Capa de ${book.title ?? "livro"}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <BookPlus className="size-8 text-muted-foreground/40" />
                  )}
                </div>
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

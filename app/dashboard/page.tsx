import Link from "next/link";
import { BookPlus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type BookRow = {
  id: string;
  title: string | null;
  genre: string | null;
  status: string | null;
  updated_at: string | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  // A tabela `books` é criada na Fase 1. Até lá, tratamos erro como lista vazia.
  const { data, error } = await supabase
    .from("books")
    .select("id, title, genre, status, updated_at")
    .order("updated_at", { ascending: false });

  const books: BookRow[] = error ? [] : (data ?? []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meus livros</h1>
          <p className="text-sm text-muted-foreground">
            Crie um novo livro ou continue um rascunho.
          </p>
        </div>
        <Button disabled>
          <BookPlus className="size-4" />
          Novo livro
        </Button>
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
                    {book.genre ?? "—"} · {book.status ?? "draft"}
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
